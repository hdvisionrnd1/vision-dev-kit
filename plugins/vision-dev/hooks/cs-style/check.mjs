// C# 스타일 Hook: 삼항연산자 / 중괄호 없는 if·else 검사
// - PreToolUse (인자 "pre"): 도구가 건드릴 .cs 파일의 현재 내용을 임시 폴더에 저장
// - PostToolUse: 저장해 둔 내용과 비교해 "이번 도구 실행이 바꾼 줄"만 검사
//   (사람이 커밋하지 않은 변경, 레거시 코드는 탓하지 않음)
//   Write/Edit/MultiEdit/Bash/PowerShell 모두 같은 방식. 새로 만든 파일은 전체 검사, 복사·이동으로 생긴 파일은 제외
// - 위반 시 exit 2 + stderr 로 Claude에게 수정 요청
// - 끄기: settings.json 의 "env" 에 "VISION_DEV_STYLE_HOOK": "off"
//   (특정 프로젝트만 끄려면 그 프로젝트의 .claude/settings.local.json 에 설정)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if ((process.env.VISION_DEV_STYLE_HOOK || "").toLowerCase() === "off") {
  process.exit(0);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES = path.join(HERE, "rules.yml");
const MODE = process.argv[2] === "pre" ? "pre" : "post";
const SNAP_DIR = path.join(os.tmpdir(), "vision-dev-snap");
// 복사·이동 명령으로 생긴 새 파일은 Claude가 쓴 코드가 아니므로 검사하지 않음
const COPY_CMD = /(^|[\s;&|(])(cp|mv|copy|move|xcopy|robocopy|Copy-Item|Move-Item|cpi|mi)\s/i;

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const tool = input.tool_name || "";
const ti = input.tool_input || {};
const cwd = input.cwd || process.cwd();
const isShell = tool === "Bash" || tool === "PowerShell";

function safeName(s) {
  return String(s || "x").replace(/[^\w.-]/g, "_");
}
let snapFile = null;
if (input.tool_use_id) {
  snapFile = path.join(SNAP_DIR, `${safeName(input.session_id)}-${safeName(input.tool_use_id)}.json`);
}

function isCsFile(file) {
  if (!/\.cs$/i.test(file)) {
    return false;
  }
  // 자동 생성 파일 제외
  if (/\.(designer|g|g\.i)\.cs$/i.test(file) || /(^|[\\/.])AssemblyInfo\.cs$/i.test(file) || /[\\/](obj|bin)[\\/]/i.test(file)) {
    return false;
  }
  return true;
}

// UTF-8이 아니면(예: 예전 한글 소스의 CP949) EUC-KR로 읽음
function decodeFile(file) {
  const buf = fs.readFileSync(file);
  let text;
  let utf8 = true;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("euc-kr").decode(buf);
    utf8 = false;
  }
  return { text: text.replace(/^﻿/, "").replace(/\r\n/g, "\n"), utf8 };
}

// Git Bash 경로(/c/Users/...)를 Windows 경로로
function fromPosix(p) {
  const m = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  if (m && process.platform === "win32") {
    return `${m[1].toUpperCase()}:${m[2] || "/"}`;
  }
  return p;
}

// 셸 명령에 나오는 .cs 파일 경로 (cd 접두사, 글롭, Git Bash 경로 처리)
function shellPaths(command) {
  let base = cwd;
  const cd = /^\s*(?:cd|Set-Location|sl|pushd)\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))\s*(?:&&|;)/i.exec(command);
  if (cd) {
    base = path.resolve(cwd, fromPosix(cd[1] || cd[2] || cd[3]));
  }
  const re = /"([^"]+\.cs)"|'([^']+\.cs)'|([^\s"'<>|;&()]+\.cs)(?![\w.])/gi;
  const files = [];
  let m;
  while ((m = re.exec(command)) !== null) {
    const raw = fromPosix(m[1] || m[2] || m[3]);
    if (/[*?]/.test(raw)) {
      if (typeof fs.globSync === "function") {
        try {
          for (const g of fs.globSync(raw, { cwd: base })) {
            files.push(path.resolve(base, g));
          }
        } catch {
          // 글롭 해석 실패는 무시
        }
      }
      continue;
    }
    files.push(path.resolve(base, raw));
  }
  return files;
}

function candidateFiles() {
  let files = [];
  if (isShell) {
    files = shellPaths(ti.command || "");
  } else if (ti.file_path) {
    files = [path.resolve(cwd, ti.file_path)];
  }
  const seen = new Set();
  const out = [];
  for (const f of files) {
    const key = f.toLowerCase();
    if (seen.has(key) || !isCsFile(f)) {
      continue;
    }
    seen.add(key);
    out.push(f);
  }
  return out;
}

// ---------- PreToolUse: 스냅샷 저장 (절대 막지 않음) ----------
if (MODE === "pre") {
  try {
    if (snapFile) {
      const files = candidateFiles();
      if (files.length > 0) {
        fs.mkdirSync(SNAP_DIR, { recursive: true });
        const snap = {};
        for (const f of files) {
          if (fs.existsSync(f)) {
            snap[f] = decodeFile(f).text;
          } else {
            snap[f] = null;
          }
        }
        fs.writeFileSync(snapFile, JSON.stringify(snap));
      }
      // 실행이 거부·실패해 남은 하루 지난 스냅샷 정리
      if (fs.existsSync(SNAP_DIR)) {
        for (const name of fs.readdirSync(SNAP_DIR)) {
          const p = path.join(SNAP_DIR, name);
          if (Date.now() - fs.statSync(p).mtimeMs > 86400000) {
            fs.unlinkSync(p);
          }
        }
      }
    }
  } catch {
    // 스냅샷 실패는 무시 (PostToolUse가 예전 방식으로 검사)
  }
  process.exit(0);
}

// ---------- PostToolUse ----------

// 바뀐 줄(새 내용 기준, 1-based) 목록. 앞뒤 공통 부분을 뺀 뒤 가운데에서 원래 없던 줄을 찾음
function changedLines(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) {
    p++;
  }
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) {
    s++;
  }
  const counts = new Map();
  for (let i = p; i < a.length - s; i++) {
    counts.set(a[i], (counts.get(a[i]) || 0) + 1);
  }
  const lines = [];
  for (let i = p; i < b.length - s; i++) {
    const c = counts.get(b[i]) || 0;
    if (c > 0) {
      counts.set(b[i], c - 1);
    } else {
      lines.push(i + 1);
    }
  }
  // 지우기만 한 경우(예: 중괄호 줄 삭제): 지운 자리의 앞뒤 줄을 바뀐 것으로 봄
  let removed = false;
  for (const c of counts.values()) {
    if (c > 0) {
      removed = true;
    }
  }
  if (removed && lines.length === 0) {
    if (p >= 1) {
      lines.push(p);
    }
    if (p + 1 <= b.length) {
      lines.push(p + 1);
    }
  }
  return lines.map((n) => [n, n]);
}

// 스냅샷이 없을 때(tool_use_id 없음 등)의 예전 방식: Edit은 new_string 위치, Write는 전체
function rangesFor(content, newStrings) {
  const ranges = [];
  for (const raw of newStrings) {
    const s = (raw || "").replace(/\r\n/g, "\n");
    if (s.trim().length === 0) {
      continue;
    }
    let idx = content.indexOf(s);
    if (idx < 0) {
      return null;
    }
    while (idx >= 0) {
      const start = content.slice(0, idx).split("\n").length;
      const end = start + s.split("\n").length - 1;
      ranges.push([start, end]);
      idx = content.indexOf(s, idx + s.length);
    }
  }
  return ranges;
}

let snap = null;
if (snapFile && fs.existsSync(snapFile)) {
  try {
    snap = JSON.parse(fs.readFileSync(snapFile, "utf8"));
  } catch {
    snap = null;
  }
  try {
    fs.unlinkSync(snapFile);
  } catch {
    // 무시
  }
}

const targets = [];
if (snap !== null) {
  for (const [file, before] of Object.entries(snap)) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const now = decodeFile(file);
    if (before === null) {
      if (isShell && COPY_CMD.test(ti.command || "")) {
        continue;
      }
      targets.push({ file, ranges: null, ...now });
      continue;
    }
    const ranges = changedLines(before, now.text);
    if (ranges.length > 0) {
      targets.push({ file, ranges, ...now });
    }
  }
} else if (!isShell) {
  for (const file of candidateFiles()) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const now = decodeFile(file);
    let ranges = null;
    if (tool === "Edit") {
      ranges = rangesFor(now.text, [ti.new_string]);
    } else if (tool === "MultiEdit") {
      ranges = rangesFor(now.text, (ti.edits || []).map((e) => e.new_string));
    }
    if (ranges === null || ranges.length > 0) {
      targets.push({ file, ranges, ...now });
    }
  }
}
if (targets.length === 0) {
  process.exit(0);
}

// ast-grep 실행 파일 찾기: AST_GREP_PATH → npm 전역 설치 → PATH 상의 ast-grep.exe
function findAstGrep() {
  const candidates = [];
  if (process.env.AST_GREP_PATH) {
    candidates.push(process.env.AST_GREP_PATH);
  }
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, "npm", "node_modules", "@ast-grep", "cli", "ast-grep.exe"));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  const w = spawnSync("where", ["ast-grep.exe"], { encoding: "utf8" });
  if (w.status === 0) {
    const first = (w.stdout || "").split(/\r?\n/).find((l) => l.trim().length > 0);
    if (first) {
      return first.trim();
    }
  }
  return null;
}

// ast-grep 미설치 시 세션당 한 번만 사용자에게 안내
function warnMissingOnce() {
  const marker = path.join(os.tmpdir(), `vision-dev-astgrep-missing-${input.session_id || "x"}`);
  if (fs.existsSync(marker)) {
    return;
  }
  try {
    fs.writeFileSync(marker, "");
  } catch {
    // 무시
  }
  process.stdout.write(
    JSON.stringify({
      systemMessage: "[vision-dev] ast-grep이 없어 C# 스타일 검사를 건너뜁니다. 설치: npm i -g @ast-grep/cli",
    })
  );
}

const SG = findAstGrep();
if (!SG) {
  warnMissingOnce();
  process.exit(0);
}

// 위반을 판단할 줄 범위(1-based). 레거시 구조 안쪽을 고쳤다고 바깥 if를 탓하지 않도록 좁게 잡음
// - 삼항: 식 시작 줄 ~ ':' 뒤 식이 시작하는 줄
// - if: if 줄 ~ 중괄호 없는 본문이 시작하는 줄
// - else: else 줄 ~ 본문이 시작하는 줄
function focusOf(m, lines) {
  const start = m.range.start.line;
  const single = (m.metaVariables && m.metaVariables.single) || {};
  if (m.ruleId === "no-ternary") {
    if (single.ALT) {
      return [start + 1, single.ALT.range.start.line + 1];
    }
    return [start + 1, start + 1];
  }
  const body = single.BODY;
  if (!body) {
    return [start + 1, start + 1];
  }
  if (m.ruleId === "no-braceless-else") {
    let elseLine = body.range.start.line;
    for (let i = body.range.start.line; i >= start; i--) {
      let text = lines[i] || "";
      if (i === body.range.start.line) {
        text = text.slice(0, body.range.start.column);
      }
      if (/\belse\b/.test(text)) {
        elseLine = i;
        break;
      }
    }
    return [elseLine + 1, body.range.start.line + 1];
  }
  return [start + 1, body.range.start.line + 1];
}

const report = [];
for (const t of targets) {
  // UTF-8이 아닌 파일은 ast-grep이 못 읽으므로 UTF-8 임시 사본으로 검사
  let scanFile = t.file;
  let temp = null;
  if (!t.utf8) {
    temp = path.join(os.tmpdir(), `vision-dev-scan-${process.pid}-${path.basename(t.file)}`);
    fs.writeFileSync(temp, t.text, "utf8");
    scanFile = temp;
  }
  const r = spawnSync(SG, ["scan", "-r", RULES, "--json=compact", scanFile], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (temp) {
    try {
      fs.unlinkSync(temp);
    } catch {
      // 무시
    }
  }
  let matches = [];
  try {
    matches = JSON.parse(r.stdout || "[]");
  } catch {
    continue;
  }
  const lines = t.text.split("\n");
  for (const m of matches) {
    const [a, b] = focusOf(m, lines);
    if (t.ranges !== null && !t.ranges.some(([x, y]) => a <= y && x <= b)) {
      continue;
    }
    const code = (lines[a - 1] || "").trim();
    report.push(`  ${path.basename(t.file)}:${a}  [${m.ruleId}] ${m.message}\n      ${code}`);
  }
}

if (report.length === 0) {
  process.exit(0);
}

process.stderr.write(
  `코드 스타일 위반 ${report.length}건 (코드 규칙: 삼항연산자·한 줄 if 금지, 항상 블록 if/else):\n` +
    report.join("\n") +
    "\n방금 수정한 코드를 블록 형태 if/else로 고쳐주세요.\n"
);
process.exit(2);
