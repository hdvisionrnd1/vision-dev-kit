// C# 솔루션/프로젝트 빌드 후 결과를 짧게 요약
// 사용법: node build.mjs [.sln | .slnx | .csproj | 폴더] [--config Debug] [--platform x64]
// - 구형(.NET Framework) csproj나 C++(vcxproj) 등 dotnet이 못 빌드하는 프로젝트가 하나라도 있으면
//   Visual Studio의 MSBuild (VS에서 빌드하는 것과 같은 방식)
//   모두 SDK 스타일 csproj면 dotnet build (VS MSBuild는 VS보다 새 .NET을 빌드하지 못함)
//   MSBuild 경로를 직접 지정하려면 환경변수 MSBUILD_PATH
// - 플랫폼을 지정하지 않으면: 솔루션/프로젝트에 x64 구성이 있으면 x64, 없으면 기본 구성
// - 출력 파일(exe/dll)이 실제로 32비트/64비트 중 무엇으로 실행되는지 PE 헤더로 확인
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BUILD_TIMEOUT_MS = 30 * 60 * 1000;

const args = process.argv.slice(2);
let target = "";
let config = "Debug";
let platform = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--config" || args[i] === "--platform") {
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      console.error(`${args[i]} 뒤에 값이 필요합니다 (예: --config Release, --platform x64)`);
      process.exit(2);
    }
    if (args[i] === "--config") {
      config = value;
    } else {
      platform = value;
    }
    i++;
  } else {
    target = args[i];
  }
}
if (!target) {
  target = process.cwd();
}

function listFiles(dir, ext) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(ext))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function listSolutions(dir) {
  return listFiles(dir, ".sln").concat(listFiles(dir, ".slnx"));
}

// 하위 폴더에서 솔루션 찾기 (bin/obj/.git 등 제외, 깊이 3까지)
function findSlnDeep(dir, depth) {
  let found = listSolutions(dir);
  if (depth === 0) {
    return found;
  }
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const e of entries) {
    if (!e.isDirectory() || /^(bin|obj|packages|node_modules|\.git|\.vs)$/i.test(e.name)) {
      continue;
    }
    found = found.concat(findSlnDeep(path.join(dir, e.name), depth - 1));
  }
  return found;
}

function resolveTarget(t) {
  const full = path.resolve(t);
  if (!fs.existsSync(full)) {
    console.error(`없는 경로입니다: ${full}`);
    process.exit(2);
  }
  if (fs.statSync(full).isFile()) {
    return full;
  }
  const slns = listSolutions(full);
  if (slns.length === 1) {
    return slns[0];
  }
  if (slns.length > 1) {
    console.error(`솔루션이 여러 개입니다. 하나를 골라 경로로 지정하세요:\n  ${slns.join("\n  ")}`);
    process.exit(2);
  }
  const projs = listFiles(full, ".csproj");
  if (projs.length === 1) {
    return projs[0];
  }
  const deep = findSlnDeep(full, 3);
  if (deep.length === 1) {
    return deep[0];
  }
  if (deep.length > 1) {
    console.error(`하위 폴더에 솔루션이 여러 개입니다. 하나를 골라 경로로 지정하세요:\n  ${deep.slice(0, 30).join("\n  ")}`);
  } else {
    console.error(`빌드할 .sln/.slnx/.csproj를 찾지 못했습니다: ${full}`);
  }
  process.exit(2);
}

function findMsbuild() {
  if (process.env.MSBUILD_PATH && fs.existsSync(process.env.MSBUILD_PATH)) {
    return process.env.MSBUILD_PATH;
  }
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const vswhere = path.join(pf86, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!fs.existsSync(vswhere)) {
    return null;
  }
  const r = spawnSync(
    vswhere,
    ["-latest", "-products", "*", "-requires", "Microsoft.Component.MSBuild", "-find", "MSBuild\\**\\Bin\\MSBuild.exe"],
    { encoding: "utf8" }
  );
  const first = (r.stdout || "").split(/\r?\n/).find((l) => l.trim().length > 0);
  if (first && fs.existsSync(first.trim())) {
    return first.trim();
  }
  return null;
}

// 솔루션/프로젝트에 x64 "구성"이 있는지 (PlatformTarget=x64만 있는 AnyCPU 구성은 해당 없음)
function hasX64(file) {
  const text = fs.readFileSync(file, "utf8");
  const lower = file.toLowerCase();
  if (lower.endsWith(".sln")) {
    return /\|x64\s*=/i.test(text);
  }
  if (lower.endsWith(".slnx")) {
    return /<Platform\s+Name\s*=\s*"x64"/i.test(text);
  }
  return /\|x64'/i.test(text);
}

// PE 헤더로 실제 실행 비트 판정 (읽을 수 없으면 빈 문자열)
function peBitness(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.length < 0x40 || b.readUInt16LE(0) !== 0x5a4d) {
      return "";
    }
    const pe = b.readUInt32LE(0x3c);
    if (b.readUInt32LE(pe) !== 0x4550) {
      return "";
    }
    const machine = b.readUInt16LE(pe + 4);
    const sections = b.readUInt16LE(pe + 6);
    const optSize = b.readUInt16LE(pe + 20);
    const opt = pe + 24;
    const magic = b.readUInt16LE(opt);
    if (magic === 0x20b) {
      if (machine === 0x8664) {
        return "x64";
      }
      return "64비트";
    }
    // PE32: .NET이면 CLR 헤더 플래그로 AnyCPU / 32비트 우선 / x86 구분
    const clrRva = b.readUInt32LE(opt + 96 + 14 * 8);
    if (clrRva === 0) {
      return "x86 (네이티브)";
    }
    let clrOff = -1;
    const secTable = opt + optSize;
    for (let i = 0; i < sections; i++) {
      const s = secTable + i * 40;
      const va = b.readUInt32LE(s + 12);
      const size = b.readUInt32LE(s + 16);
      const raw = b.readUInt32LE(s + 20);
      if (clrRva >= va && clrRva < va + size) {
        clrOff = clrRva - va + raw;
      }
    }
    if (clrOff < 0) {
      return "";
    }
    const flags = b.readUInt32LE(clrOff + 16);
    const required32 = (flags & 0x2) !== 0;
    const preferred32 = (flags & 0x20000) !== 0;
    const isDll = file.toLowerCase().endsWith(".dll");
    if (required32 && preferred32) {
      return "AnyCPU + 32비트 우선 → 32비트로 실행";
    }
    if (required32) {
      return "x86 → 32비트로 실행";
    }
    if (isDll) {
      return "AnyCPU → 불러오는 exe의 비트를 따름";
    }
    return "AnyCPU → 64비트 Windows에서 64비트로 실행";
  } catch {
    return "";
  }
}

// 솔루션에 들어 있는 프로젝트 파일 경로
function projectsOf(file) {
  const lower = file.toLowerCase();
  if (!lower.endsWith(".sln") && !lower.endsWith(".slnx")) {
    return [file];
  }
  const text = fs.readFileSync(file, "utf8");
  let re = /^Project\("[^"]*"\)\s*=\s*"[^"]*",\s*"([^"]+)"/gim;
  if (lower.endsWith(".slnx")) {
    re = /<Project\s+Path\s*=\s*"([^"]+)"/gi;
  }
  const projects = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    // 솔루션 폴더는 확장자가 없는 이름이라 제외
    if (/\.\w+proj$/i.test(m[1])) {
      projects.push(path.resolve(path.dirname(file), m[1]));
    }
  }
  return projects;
}

// dotnet build로는 안 되는 프로젝트(구형 csproj, vcxproj, vbproj, 설치 프로젝트 등)가 있는지
function needsMsbuild(file) {
  for (const p of projectsOf(file)) {
    if (!p.toLowerCase().endsWith(".csproj")) {
      return true;
    }
    try {
      if (!/<Project[^>]*\sSdk\s*=/i.test(fs.readFileSync(p, "utf8"))) {
        return true;
      }
    } catch {
      // 없는 프로젝트는 무시
    }
  }
  return false;
}

const file = resolveTarget(target);
if (!platform && hasX64(file)) {
  platform = "x64";
}

const legacy = needsMsbuild(file);
let msbuild = null;
if (legacy) {
  msbuild = findMsbuild();
}
const log = path.join(os.tmpdir(), `vision-dev-build-${process.pid}.log`);
const common = [
  file,
  "-nologo",
  "-m",
  "-restore",
  "-p:RestorePackagesConfig=true",
  `-p:Configuration=${config}`,
  "-noconsolelogger",
  `-flp:logfile=${log};encoding=utf-8;verbosity=minimal`,
];
if (platform) {
  common.push(`-p:Platform=${platform}`);
}

let exe;
let cmdArgs;
if (msbuild) {
  exe = msbuild;
  cmdArgs = common;
} else {
  exe = "dotnet";
  cmdArgs = ["build", ...common];
}

console.log(`# 빌드: ${file}`);
if (msbuild) {
  console.log(`# 도구: ${msbuild}`);
} else if (legacy) {
  console.log("# 도구: dotnet build (구형/C++ 프로젝트가 있는데 Visual Studio MSBuild를 찾지 못함, 실패하면 VS 또는 Build Tools 설치 필요)");
} else {
  console.log("# 도구: dotnet build (SDK 스타일 프로젝트)");
}
console.log(`# 구성: ${config}|${platform || "기본"}`);

const env = { ...process.env, DOTNET_CLI_UI_LANGUAGE: "en", VSLANG: "1033", MSBUILDTERMINALLOGGER: "off" };
const r = spawnSync(exe, cmdArgs, { encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024, timeout: BUILD_TIMEOUT_MS });
if (r.error) {
  if (r.error.code === "ETIMEDOUT") {
    console.error(`빌드가 ${BUILD_TIMEOUT_MS / 60000}분 안에 끝나지 않아 중단했습니다.`);
  } else {
    console.error(`빌드 도구를 실행하지 못했습니다: ${r.error.message}`);
  }
  if (!msbuild) {
    console.error("Visual Studio(또는 Build Tools)나 .NET SDK가 설치되어 있는지 확인하세요.");
  }
  process.exit(2);
}

let text = "";
try {
  text = fs.readFileSync(log, "utf8");
  fs.unlinkSync(log);
} catch {
  text = `${r.stdout || ""}\n${r.stderr || ""}`;
}

// MSBuild는 같은 오류를 두 번 출력하므로 끝의 [프로젝트] 부분을 떼고 중복 제거
const errors = new Set();
const warnings = new Map();
const outputs = [];
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim().replace(/\s*\[[^\]]+\.\w+proj\]$/i, "");
  if (/:\s*error\s/i.test(line)) {
    errors.add(line);
  } else if (/:\s*warning\s/i.test(line)) {
    const m = /warning\s+([A-Z]+\d+)/i.exec(line);
    let code = "기타";
    if (m) {
      code = m[1].toUpperCase();
    }
    if (!warnings.has(code)) {
      warnings.set(code, []);
    }
    const list = warnings.get(code);
    if (!list.includes(line)) {
      list.push(line);
    }
  } else {
    const o = /^(\S.*?) -> (.+\.(exe|dll))$/i.exec(line);
    if (o) {
      outputs.push({ project: o[1], file: o[2] });
    }
  }
}

const ok = r.status === 0 && errors.size === 0;
for (const o of outputs) {
  o.bit = peBitness(o.file);
}

// MSB3270: 프로젝트와 참조의 비트가 다름. 참조 쪽 비트(AMD64/x86)를 모아 실행 exe의 비트와 비교
const mismatches = [];
for (const w of warnings.get("MSB3270") || []) {
  const m = /architecture of the project being built "([^"]+)" and the processor architecture of the reference "([^"]+)", "([^"]+)"/i.exec(w);
  if (m) {
    mismatches.push({ project: m[1], ref: m[2], arch: m[3].toUpperCase(), text: w });
  } else {
    mismatches.push({ project: "", ref: "", arch: "", text: w });
  }
}
const exes = outputs.filter((o) => o.file.toLowerCase().endsWith(".exe"));
const runs32 = exes.some((o) => o.bit.includes("32비트로 실행"));
const runs64 = exes.some((o) => o.bit === "x64" || o.bit.includes("64비트로 실행"));
let runRisk = "";
if (runs32 && mismatches.some((x) => x.arch === "AMD64" || x.arch === "X64")) {
  runRisk = "32비트로 실행되는 exe가 64비트 전용 참조를 씁니다";
} else if (runs64 && mismatches.some((x) => x.arch === "X86")) {
  runRisk = "64비트로 실행되는 exe가 32비트 전용 참조를 씁니다";
}

console.log("");
if (ok && runRisk) {
  console.log(`BUILD OK, 하지만 실행 시 실패 위험: ${runRisk} (아래 MSB3270)`);
} else if (ok) {
  console.log("BUILD OK");
} else {
  console.log(`BUILD FAILED (오류 ${errors.size}건, exit ${r.status})`);
}

if (errors.size > 0) {
  console.log("\n## 오류");
  for (const e of [...errors].slice(0, 30)) {
    console.log(`- ${e}`);
  }
  if (errors.size > 30) {
    console.log(`... ${errors.size - 30}건 더`);
  }
}

if (mismatches.length > 0) {
  console.log("\n## 플랫폼 불일치 (MSB3270)");
  for (const x of mismatches) {
    if (x.arch) {
      console.log(`- 프로젝트는 ${x.project}, 참조 ${x.ref}는 ${x.arch} 전용`);
    } else {
      console.log(`- ${x.text}`);
    }
  }
  if (mismatches.some((x) => x.arch === "AMD64" || x.arch === "X64")) {
    console.log("  64비트 전용 참조: exe가 32비트로 실행되면 BadImageFormatException 등으로 실패합니다. x64 구성으로 빌드하세요.");
  }
  if (mismatches.some((x) => x.arch === "X86")) {
    console.log("  32비트 전용 참조: exe가 64비트로 실행되면 실패합니다. x86 구성으로 빌드하거나 64비트용 참조로 바꾸세요.");
  }
}

if (warnings.size > 0) {
  let total = 0;
  const parts = [];
  for (const [code, list] of warnings) {
    total += list.length;
    parts.push(`${code} ${list.length}`);
  }
  console.log(`\n## 경고 ${total}건: ${parts.join(", ")}`);
  console.log("(새로 생긴 경고만 확인하려면 해당 코드로 다시 물어보세요. 기존 경고는 대부분 레거시입니다)");
}

if (outputs.length > 0) {
  console.log("\n## 출력");
  for (const o of outputs) {
    let suffix = "";
    if (o.bit) {
      suffix = `  [${o.bit}]`;
    }
    console.log(`- ${o.project}: ${o.file}${suffix}`);
  }
}

if (ok) {
  process.exit(0);
}
process.exit(1);
