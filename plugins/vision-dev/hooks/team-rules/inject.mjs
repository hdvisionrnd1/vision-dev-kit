// SessionStart hook: 팀 규칙(rules.md)을 세션 컨텍스트에 주입
// - 끄기: settings.json 의 "env" 에 "VISION_DEV_TEAM_RULES": "off"
//   (특정 프로젝트만 끄려면 그 프로젝트의 .claude/settings.local.json 에 설정)
// - oh-my-claudecode(OMC)가 켜져 있으면 Superpowers와 충돌하므로 사용자에게 경고
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES = path.join(HERE, "rules.md");
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

// 사용자 설정에서 켜져 있는 OMC 플러그인 ID 목록
function findEnabledOmc() {
  const ids = [];
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "settings.json"), "utf8"));
    const enabled = settings.enabledPlugins || {};
    for (const [id, on] of Object.entries(enabled)) {
      if (id.startsWith("oh-my-claudecode@") && on === true) {
        ids.push(id);
      }
    }
  } catch {
    // 설정 파일이 없거나 읽을 수 없으면 경고하지 않음
  }
  return ids;
}

const output = {};
const contextParts = [];

if ((process.env.VISION_DEV_TEAM_RULES || "").toLowerCase() !== "off") {
  try {
    contextParts.push(fs.readFileSync(RULES, "utf8"));
  } catch {
    // 규칙 파일이 없으면 주입하지 않음
  }
}

const omc = findEnabledOmc();
if (omc.length > 0) {
  const disableCmds = omc.map((id) => `claude plugin disable ${id}`).join(" / ");
  output.systemMessage =
    `[vision-dev] oh-my-claudecode(OMC)가 켜져 있어 Superpowers와 작업 지침이 충돌합니다. ` +
    `끄려면: ${disableCmds} (README 'OMC가 설치된 PC' 참고)`;
  contextParts.push(
    "참고: 이 PC에는 oh-my-claudecode(OMC) 플러그인이 켜져 있어 Superpowers와 작업 지침이 충돌할 수 있다. " +
      "사용자가 작업 방식에 대해 혼란을 겪으면 vision-dev README의 'OMC가 설치된 PC' 절차(OMC 비활성화 + CLAUDE.md의 OMC 블록 제거)를 안내한다."
  );
}

if (contextParts.length > 0) {
  output.hookSpecificOutput = {
    hookEventName: "SessionStart",
    additionalContext: contextParts.join("\n\n"),
  };
}

if (Object.keys(output).length > 0) {
  process.stdout.write(JSON.stringify(output));
}
