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
// rules.md 안의 {{PLUGIN_ROOT}}는 이 PC의 플러그인 설치 경로로 바꿔서 주입
const PLUGIN_ROOT = path.resolve(HERE, "..", "..").split(path.sep).join("/");
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");

// 프로젝트 폴더: CLAUDE_PROJECT_DIR(프로젝트 루트) → hook 입력의 cwd → 현재 폴더
function findProjectDir() {
  if (process.env.CLAUDE_PROJECT_DIR) {
    return process.env.CLAUDE_PROJECT_DIR;
  }
  try {
    const input = JSON.parse(fs.readFileSync(0, "utf8"));
    if (input.cwd) {
      return input.cwd;
    }
  } catch {
    // 입력이 없으면 아래 값 사용
  }
  return process.cwd();
}

function readEnabledPlugins(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")).enabledPlugins || {};
  } catch {
    // 설정 파일이 없거나 읽을 수 없으면 없는 것으로 봄
    return {};
  }
}

// 켜져 있는 OMC 플러그인 ID와 그 설정 파일 목록
// 우선순위: 프로젝트 settings.local.json > 프로젝트 settings.json > 사용자 settings.json
function findEnabledOmc() {
  const projectDir = findProjectDir();
  const files = [
    path.join(CONFIG_DIR, "settings.json"),
    path.join(projectDir, ".claude", "settings.json"),
    path.join(projectDir, ".claude", "settings.local.json"),
  ];
  const state = new Map();
  for (const file of files) {
    for (const [id, on] of Object.entries(readEnabledPlugins(file))) {
      if (id.startsWith("oh-my-claudecode@")) {
        state.set(id, { on: on === true, file });
      }
    }
  }
  const found = [];
  for (const [id, s] of state) {
    if (s.on) {
      found.push({ id, file: s.file });
    }
  }
  return found;
}

const output = {};
const contextParts = [];

if ((process.env.VISION_DEV_TEAM_RULES || "").toLowerCase() !== "off") {
  try {
    contextParts.push(fs.readFileSync(RULES, "utf8").split("{{PLUGIN_ROOT}}").join(PLUGIN_ROOT));
  } catch {
    // 규칙 파일이 없으면 주입하지 않음
  }
}

const omc = findEnabledOmc();
if (omc.length > 0) {
  const where = omc.map((o) => `${o.id} (${o.file})`).join(", ");
  const disableCmds = omc.map((o) => `claude plugin disable ${o.id}`).join(" / ");
  output.systemMessage =
    `[vision-dev] oh-my-claudecode(OMC)가 켜져 있어 Superpowers와 작업 지침이 충돌합니다: ${where}. ` +
    `끄려면: ${disableCmds}, 프로젝트 설정 파일에서 켠 경우 그 파일의 enabledPlugins 값을 false로 바꾸세요 (README 'OMC가 설치된 PC' 참고)`;
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
