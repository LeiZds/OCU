#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const hook = path.join(repoRoot, "hooks", "ocu-loop-guard.mjs");
const stateDirectory = mkdtempSync(
  path.join(tmpdir(), "ocu-hook-guard-test-"),
);
const toolName =
  "mcp__plugin_open-computer-use_ocu__get_app_state";
const sessionID = "guard-test-session";

try {
  run({
    hook_event_name: "UserPromptSubmit",
    session_id: sessionID,
    user_prompt: "test",
  });

  for (let index = 0; index < 2; index += 1) {
    const pre = run({
      hook_event_name: "PreToolUse",
      session_id: sessionID,
      tool_name: toolName,
      tool_input: { app: "Fixture", disable_screenshot: true },
    });
    assert.equal(pre.stdout, "");

    run({
      hook_event_name: "PostToolUse",
      session_id: sessionID,
      tool_name: toolName,
      tool_input: { app: "Fixture", disable_screenshot: true },
      tool_result:
        "App=Fixture\nNo accessibility changes since the previous presented state.",
    });
  }

  const blocked = run({
    hook_event_name: "PreToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
  });
  const decision = JSON.parse(blocked.stdout);
  assert.equal(
    decision.hookSpecificOutput.permissionDecision,
    "deny",
  );
  assert.equal(
    decision.hookSpecificOutput.hookEventName,
    "PreToolUse",
  );
  assert.match(decision.systemMessage, /same result twice/);

  run({
    hook_event_name: "UserPromptSubmit",
    session_id: sessionID,
    user_prompt: "new turn",
  });
  const reset = run({
    hook_event_name: "PreToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
  });
  assert.equal(reset.stdout, "");

  run({
    hook_event_name: "PostToolUseFailure",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
    error: "permission denied",
  });
  const secondFailurePre = run({
    hook_event_name: "PreToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: false },
  });
  assert.equal(secondFailurePre.stdout, "");
  run({
    hook_event_name: "PostToolUseFailure",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: false },
    error_message: "backend unavailable",
  });
  const failureBlocked = run({
    hook_event_name: "PreToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
  });
  const failureDecision = JSON.parse(failureBlocked.stdout);
  assert.equal(
    failureDecision.hookSpecificOutput.permissionDecision,
    "deny",
  );
  assert.match(failureDecision.systemMessage, /two consecutive OCU calls failed/);

  const transcriptPath = path.join(stateDirectory, "transcript.jsonl");
  run({
    hook_event_name: "UserPromptSubmit",
    session_id: sessionID,
    prompt: "Reply exactly OCU_EXACT_OK.",
  });
  run({
    hook_event_name: "PreToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
  });
  run({
    hook_event_name: "PostToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
    tool_result: "App=Fixture\nTask evidence is present.",
  });
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Done. OCU_EXACT_OK" },
        ],
      },
    })}\n`,
  );
  const stopBlocked = run({
    hook_event_name: "Stop",
    session_id: sessionID,
    transcript_path: transcriptPath,
  });
  const stopDecision = JSON.parse(stopBlocked.stdout);
  assert.equal(stopDecision.decision, "block");
  assert.match(stopDecision.reason, /OCU_EXACT_OK alone/);

  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "OCU_EXACT_OK" },
        ],
      },
    })}\n`,
  );
  const stopAllowed = run({
    hook_event_name: "Stop",
    session_id: sessionID,
    transcript_path: transcriptPath,
  });
  assert.equal(stopAllowed.stdout, "");

  run({
    hook_event_name: "UserPromptSubmit",
    session_id: sessionID,
    prompt: "Reply exactly SHOULD_NOT_APPEAR.",
  });
  run({
    hook_event_name: "PreToolUse",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
  });
  run({
    hook_event_name: "PostToolUseFailure",
    session_id: sessionID,
    tool_name: toolName,
    tool_input: { app: "Fixture", disable_screenshot: true },
    error: "Accessibility permission denied",
  });
  writeFileSync(
    transcriptPath,
    `${JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Accessibility permission denied." },
        ],
      },
    })}\n`,
  );
  const failedStopAllowed = run({
    hook_event_name: "Stop",
    session_id: sessionID,
    transcript_path: transcriptPath,
  });
  assert.equal(failedStopAllowed.stdout, "");

  process.stdout.write("Claude OCU hook guard checks passed.\n");
} finally {
  rmSync(stateDirectory, { recursive: true, force: true });
}

function run(input) {
  const result = spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    input: JSON.stringify(input),
    env: {
      ...process.env,
      OCU_CLAUDE_GUARD_STATE_DIR: stateDirectory,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}
