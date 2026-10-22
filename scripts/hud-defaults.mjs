// claude-hud 팀 기본 설정을 config.json에 넣는다 (install.ps1이 호출)
// 사용법: node hud-defaults.mjs <claude-hud config.json 경로>
// - 이미 있는 값은 바꾸지 않고, 없는 항목만 추가 (팀원이 /claude-hud:configure로 바꾼 설정 유지)
// - 결과로 추가한 항목 목록을 출력
import fs from "node:fs";
import path from "node:path";

const TEAM_DEFAULTS = {
  // 세션을 연 폴더를 전체 경로로 표시
  pathLevels: "full",
  display: {
    showTools: true,
    showSkills: true,
    showAgents: true,
    showTodos: true,
    showDuration: true,
    // 추론 강도를 모델 옆에 표시: [Opus ◑ high]
    showEffortLevel: true,
    // 사용량을 이름표와 함께 한 줄로: 5h: 4% (4h 43m) | 7d: 9% (3d) | Fable: 10% (3d)
    usageCompact: true,
    sevenDayThreshold: 0,
    // Fable 등 모델별 주간 사용량: vision-dev의 usage Hook이 이 파일을 갱신
    externalUsagePath: "~/.claude/cache/vision-dev/usage-snapshot.json",
    externalUsageFreshnessMs: 1800000,
  },
};

const file = process.argv[2];
if (!file) {
  console.error("usage: node hud-defaults.mjs <config.json>");
  process.exit(1);
}

let config = {};
if (fs.existsSync(file)) {
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    console.error(`could not read ${file} (left as is)`);
    process.exit(2);
  }
}

const added = [];
function merge(target, defaults, prefix) {
  for (const [key, value] of Object.entries(defaults)) {
    const name = prefix + key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (target[key] === undefined || target[key] === null || typeof target[key] !== "object") {
        target[key] = {};
      }
      merge(target[key], value, name + ".");
    } else if (target[key] === undefined) {
      target[key] = value;
      added.push(name);
    }
  }
}
merge(config, TEAM_DEFAULTS, "");

if (added.length > 0) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  console.log(`added: ${added.join(", ")}`);
} else {
  console.log("added: (none)");
}
