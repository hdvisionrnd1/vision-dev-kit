// 사용량 스냅샷 Hook (SessionStart / UserPromptSubmit)
// - Claude Code가 상태 표시줄에 넘겨주는 사용량에는 5시간·주간만 있고 Fable 같은 모델별 주간 사용량이 없다.
//   그래서 Anthropic 사용량 API(/api/oauth/usage)를 로그인 토큰으로 불러 claude-hud의 외부 사용량 파일 형식으로 저장한다.
//   claude-hud 설정의 display.externalUsagePath 가 이 파일을 가리킨다.
// - claude-hud를 쓰는 PC에서만, 마지막 저장 후 3분이 지났을 때만 백그라운드로 실행한다 (입력을 느리게 하지 않음)
// - 토큰은 Anthropic 서버에만 보내고, 만료된 토큰은 갱신하지 않는다 (갱신은 Claude Code가 함)
// - 아무것도 출력하지 않는다 (UserPromptSubmit 출력은 대화에 섞이므로)
// - 끄기: settings.json 의 "env" 에 "VISION_DEV_USAGE_FETCH": "off"
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if ((process.env.VISION_DEV_USAGE_FETCH || "").toLowerCase() === "off") {
  process.exit(0);
}

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const SNAPSHOT = path.join(os.homedir(), ".claude", "cache", "vision-dev", "usage-snapshot.json");
const MIN_INTERVAL_MS = 3 * 60 * 1000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
}

function usesClaudeHud() {
  const settings = readJson(path.join(CONFIG_DIR, "settings.json"));
  if (!settings || !settings.statusLine) {
    return false;
  }
  return /claude-hud/i.test(String(settings.statusLine.command || ""));
}

function isFresh() {
  try {
    return Date.now() - fs.statSync(SNAPSHOT).mtimeMs < MIN_INTERVAL_MS;
  } catch {
    return false;
  }
}

function toWindow(w) {
  if (!w || typeof w.utilization !== "number") {
    return null;
  }
  return { used_percentage: w.utilization, resets_at: w.resets_at || null };
}

function toSnapshot(usage) {
  const scoped = [];
  for (const l of usage.limits || []) {
    const name = l && l.scope && l.scope.model && l.scope.model.display_name;
    if (l && l.kind === "weekly_scoped" && name && typeof l.percent === "number") {
      scoped.push({ display_name: name, utilization: l.percent, resets_at: l.resets_at || null });
    }
  }
  return {
    updated_at: new Date().toISOString(),
    five_hour: toWindow(usage.five_hour),
    seven_day: toWindow(usage.seven_day),
    model_scoped: scoped,
  };
}

function fetchAndWrite() {
  const cred = readJson(path.join(CONFIG_DIR, ".credentials.json"));
  const oauth = (cred && cred.claudeAiOauth) || {};
  if (!oauth.accessToken || (oauth.expiresAt && oauth.expiresAt < Date.now())) {
    return;
  }
  const req = https.request(
    {
      host: "api.anthropic.com",
      path: "/api/oauth/usage",
      method: "GET",
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${oauth.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
    },
    (res) => {
      let body = "";
      res.on("data", (d) => {
        body += d;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return;
        }
        try {
          const snap = toSnapshot(JSON.parse(body));
          fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
          const tmp = `${SNAPSHOT}.${process.pid}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(snap));
          fs.renameSync(tmp, SNAPSHOT);
        } catch {
          // 응답 형식이 바뀌었으면 조용히 건너뜀
        }
      });
    }
  );
  req.on("timeout", () => {
    req.destroy();
  });
  req.on("error", () => {
    // 네트워크 오류는 무시 (다음 실행 때 다시 시도)
  });
  req.end();
}

if (process.argv[2] === "fetch") {
  fetchAndWrite();
} else {
  // Hook 입력(stdin)은 쓰지 않지만 파이프가 막히지 않게 비워 둠
  try {
    fs.readFileSync(0);
  } catch {
    // 입력 없음
  }
  if (usesClaudeHud() && !isFresh()) {
    // 마지막 저장 시각을 먼저 갱신해 동시에 여러 번 호출되지 않게 함
    try {
      fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
      if (fs.existsSync(SNAPSHOT)) {
        const now = new Date();
        fs.utimesSync(SNAPSHOT, now, now);
      }
    } catch {
      // 무시
    }
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "fetch"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  }
}
