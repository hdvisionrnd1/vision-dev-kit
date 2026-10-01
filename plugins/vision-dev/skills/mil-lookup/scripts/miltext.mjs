// MIL 레퍼런스 HTML에서 스크립트/스타일을 제거하고 본문 텍스트만 출력
// 사용법: node miltext.mjs <함수명 또는 .htm 경로> [검색어]
//   검색어를 주면 해당 단어가 포함된 줄과 앞뒤 문맥만 출력
import fs from "node:fs";
import path from "node:path";

// MIL을 기본 위치가 아닌 곳에 설치했다면 환경변수 MIL_DOC_DIR 로 Reference 폴더 지정
const REF = process.env.MIL_DOC_DIR || "C:/Program Files/Matrox Imaging/MIL/DOC/mil_help/content/Reference";
const arg = process.argv[2];
const keyword = process.argv[3];

if (!arg) {
  console.error("usage: node miltext.mjs <MbufAlloc2d | path.htm> [keyword]");
  process.exit(1);
}
if (!fs.existsSync(REF)) {
  console.error(`MIL 레퍼런스 폴더가 없습니다: ${REF}\nMIL이 설치되어 있지 않거나 다른 위치라면 환경변수 MIL_DOC_DIR 을 지정하세요.`);
  process.exit(3);
}

function findFile(name) {
  if (fs.existsSync(name)) {
    return name;
  }
  const target = name.toLowerCase().replace(/\.htm$/, "") + ".htm";
  for (const dir of fs.readdirSync(REF)) {
    const full = path.join(REF, dir);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    for (const f of fs.readdirSync(full)) {
      if (f.toLowerCase() === target) {
        return path.join(full, f);
      }
    }
  }
  return null;
}

const file = findFile(arg);
if (!file) {
  console.error(`not found: ${arg}`);
  process.exit(2);
}

let html = fs.readFileSync(file, "utf8");
html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
html = html.replace(/<(br|\/p|\/div|\/tr|\/h\d|\/li)[^>]*>/gi, "\n");
html = html.replace(/<\/t[dh]>/gi, " | ");
html = html.replace(/<[^>]+>/g, "");
html = html
  .replace(/&nbsp;/g, " ")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const lines = html
  .split("\n")
  .map((l) => l.replace(/\s+/g, " ").trim())
  .filter((l) => l.length > 0 && l !== "|");

console.log(`# ${file}`);
if (!keyword) {
  console.log(lines.join("\n"));
  process.exit(0);
}

const kw = keyword.toLowerCase();
const shown = new Set();
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].toLowerCase().includes(kw)) {
    continue;
  }
  const from = Math.max(0, i - 3);
  const to = Math.min(lines.length - 1, i + 6);
  if (shown.has(from)) {
    continue;
  }
  console.log(`--- line ${i}`);
  for (let j = from; j <= to; j++) {
    shown.add(j);
    console.log(lines[j]);
  }
}
