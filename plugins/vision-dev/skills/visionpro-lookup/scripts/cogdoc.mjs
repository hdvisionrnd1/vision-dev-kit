// VisionPro 추출 help(HTML) 검색/본문 추출 도구
// 사용법:
//   node cogdoc.mjs find <키워드...>          제목 색인에서 검색 (색인이 없으면 최초 1회 생성)
//   node cogdoc.mjs text <파일명|경로> [검색어]  본문 텍스트만 출력 (검색어 주면 해당 부분만)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// help 위치: 환경변수 COGNEX_HELP_DIR 또는 extract-help.ps1 의 기본 추출 위치
const HTML_DIR =
  process.env.COGNEX_HELP_DIR || path.join(os.homedir(), ".claude", "tools", "cognex-doc", "VisionPro", "html");
// 색인은 플러그인 폴더 밖(업데이트 시 지워지지 않는 곳)에 저장
const INDEX_DIR = path.join(os.homedir(), ".claude", "cache", "vision-dev");
const INDEX = path.join(INDEX_DIR, "cognex-titles.tsv");

if (!fs.existsSync(HTML_DIR)) {
  // VisionPro 설치 폴더: 환경변수 VISIONPRO_DIR 또는 기본 위치
  const vproDir =
    process.env.VISIONPRO_DIR || path.join(process.env.ProgramFiles || "C:\\Program Files", "Cognex", "VisionPro");
  if (!fs.existsSync(vproDir)) {
    // VisionPro 자체가 없는 PC: 조회할 로컬 문서가 전혀 없음
    console.error(
      `이 PC에는 Cognex VisionPro가 설치되어 있지 않습니다 (${vproDir} 없음).\n` +
        "로컬 VisionPro 문서(help, IntelliSense XML, 샘플)를 조회할 수 없습니다.\n" +
        "추측으로 API를 쓰지 말고 사용자에게 이 사실을 알릴 것."
    );
  } else {
    // VisionPro는 있는데 help만 추출되지 않은 PC
    console.error(
      `VisionPro help(HTML)가 아직 추출되지 않았습니다: ${HTML_DIR}\n` +
        "vision-dev-kit 저장소의 scripts/extract-cognex-help.ps1 을 실행해 추출하세요(자동 설치기를 다시 실행해도 됨).\n" +
        `그 전까지는 ${path.join(vproDir, "ReferencedAssemblies")}\\*.xml 과 ${path.join(vproDir, "samples", "Programming")} 으로 확인합니다.`
    );
  }
  process.exit(3);
}

function buildIndex() {
  console.error("[cogdoc] 제목 색인 최초 생성 중 (수 분 걸릴 수 있음)...");
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const out = [];
  const buf = Buffer.alloc(4096);
  for (const f of fs.readdirSync(HTML_DIR)) {
    if (!f.toLowerCase().endsWith(".htm")) {
      continue;
    }
    const fd = fs.openSync(path.join(HTML_DIR, f), "r");
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const m = /<title>([^<]*)/i.exec(buf.toString("utf8", 0, n));
    let title = "";
    if (m) {
      title = m[1].replace(/\s+/g, " ").trim();
    }
    out.push(`${f}\t${title}`);
  }
  fs.writeFileSync(INDEX, out.join("\n"), "utf8");
  return out;
}

function loadIndex() {
  if (fs.existsSync(INDEX)) {
    return fs.readFileSync(INDEX, "utf8").split("\n");
  }
  return buildIndex();
}

function htmlToText(html) {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<(br|\/p|\/div|\/tr|\/h\d|\/li|\/pre)[^>]*>/gi, "\n");
  s = s.replace(/<\/t[dh]>/gi, " | ");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0 && l !== "|");
}

const [mode, ...rest] = process.argv.slice(2);

if (mode === "find") {
  if (rest.length === 0) {
    console.error("usage: node cogdoc.mjs find <keyword...>");
    process.exit(1);
  }
  const words = rest.map((w) => w.toLowerCase());
  const hits = loadIndex().filter((line) => {
    const low = line.toLowerCase();
    return words.every((w) => low.includes(w));
  });
  // 개념 문서(GUID 파일명)와 타입 문서를 먼저, 멤버 문서는 뒤로
  const rank = (line) => {
    if (/^[0-9a-f]{8}-/i.test(line)) {
      return 0;
    }
    if (line.startsWith("T_")) {
      return 1;
    }
    return 2;
  };
  hits.sort((a, b) => rank(a) - rank(b));
  console.log(hits.slice(0, 60).join("\n"));
  if (hits.length > 60) {
    console.log(`... (${hits.length - 60} more, 키워드를 추가해 좁히세요)`);
  }
} else if (mode === "text") {
  const name = rest[0];
  const keyword = rest[1];
  if (!name) {
    console.error("usage: node cogdoc.mjs text <file.htm> [keyword]");
    process.exit(1);
  }
  let file = name;
  if (!fs.existsSync(file)) {
    file = path.join(HTML_DIR, name.endsWith(".htm") ? name : name + ".htm");
  }
  if (!fs.existsSync(file)) {
    console.error(`not found: ${name}`);
    process.exit(2);
  }
  const lines = htmlToText(fs.readFileSync(file, "utf8"));
  console.log(`# ${file}`);
  if (!keyword) {
    console.log(lines.join("\n"));
  } else {
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
  }
} else {
  console.error("usage: node cogdoc.mjs find <keyword...> | text <file> [keyword]");
  process.exit(1);
}
