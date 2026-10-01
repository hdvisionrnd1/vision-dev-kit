// PostToolUse hook: .cs 파일 수정 시 삼항연산자 / 중괄호 없는 if·else 검사
// - Write: 파일 전체 검사
// - Edit/MultiEdit: 이번에 수정된 부분(new_string)이 차지하는 줄만 검사 (기존 레거시 코드는 무시)
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

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
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

const tool = input.tool_name || "";
const ti = input.tool_input || {};
const file = ti.file_path || "";

if (!/\.cs$/i.test(file)) {
  process.exit(0);
}
// 자동 생성 파일 제외
if (/\.(designer|g|g\.i)\.cs$/i.test(file) || /(^|[\\/.])AssemblyInfo\.cs$/i.test(file) || /[\\/](obj|bin)[\\/]/i.test(file)) {
  process.exit(0);
}
if (!fs.existsSync(file)) {
  process.exit(0);
}
const SG = findAstGrep();
if (!SG) {
  warnMissingOnce();
  process.exit(0);
}

const content = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

// 검사할 줄 범위(1-based, inclusive) 계산. null 이면 전체 검사
function rangesFor(newStrings) {
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

let ranges = null;
if (tool === "Edit") {
  ranges = rangesFor([ti.new_string]);
} else if (tool === "MultiEdit") {
  ranges = rangesFor((ti.edits || []).map((e) => e.new_string));
}
if (ranges !== null && ranges.length === 0) {
  process.exit(0);
}

const r = spawnSync(SG, ["scan", "-r", RULES, "--json=compact", file], { encoding: "utf8" });
let matches = [];
try {
  matches = JSON.parse(r.stdout || "[]");
} catch {
  process.exit(0);
}

const hits = matches.filter((m) => {
  if (ranges === null) {
    return true;
  }
  const line = m.range.start.line + 1;
  return ranges.some(([a, b]) => line >= a && line <= b);
});

if (hits.length === 0) {
  process.exit(0);
}

const lines = hits.map((m) => {
  const line = m.range.start.line + 1;
  const code = (m.lines || m.text || "").split("\n")[0].trim();
  return `  ${path.basename(file)}:${line}  [${m.ruleId}] ${m.message}\n      ${code}`;
});
process.stderr.write(
  `코드 스타일 위반 ${hits.length}건 (코드 규칙: 삼항연산자·한 줄 if 금지, 항상 블록 if/else):\n` +
    lines.join("\n") +
    "\n방금 수정한 코드를 블록 형태 if/else로 고쳐주세요.\n"
);
process.exit(2);
