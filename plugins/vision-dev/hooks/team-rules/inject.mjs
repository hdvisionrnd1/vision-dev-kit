// SessionStart hook: 팀 규칙(rules.md)을 세션 컨텍스트에 주입
// - 끄기: settings.json 의 "env" 에 "VISION_DEV_TEAM_RULES": "off"
//   (특정 프로젝트만 끄려면 그 프로젝트의 .claude/settings.local.json 에 설정)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if ((process.env.VISION_DEV_TEAM_RULES || "").toLowerCase() === "off") {
  process.exit(0);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES = path.join(HERE, "rules.md");

let text = "";
try {
  text = fs.readFileSync(RULES, "utf8");
} catch {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: text,
    },
  })
);
