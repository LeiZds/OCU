#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const input = await readInput();
const event = input.hook_event_name ?? "";
const sessionID = safeSessionID(input.session_id);
const stateDirectory =
  process.env.OCU_CLAUDE_GUARD_STATE_DIR ??
  path.join(tmpdir(), "open-computer-use-claude-guard");
const statePath = path.join(stateDirectory, `${sessionID}.json`);

if (event === "SessionEnd") {
  rmSync(statePath, { force: true });
  process.exit(0);
}

if (event === "UserPromptSubmit") {
  const state = emptyState();
  state.exactFinalToken = requestedExactFinalToken(
    input.prompt ?? input.user_prompt,
  );
  saveState(state);
  process.exit(0);
}

if (event === "Stop") {
  handleStop();
  process.exit(0);
}

if (!isOCUTool(input.tool_name)) {
  process.exit(0);
}

if (event === "PreToolUse") {
  handlePreToolUse();
  process.exit(0);
}

if (event === "PostToolUse" || event === "PostToolUseFailure") {
  handlePostToolUse(event === "PostToolUseFailure");
}

function handlePreToolUse() {
  const state = loadState();
  const tool = shortToolName(input.tool_name);
  const signature = callSignature(tool, input.tool_input);
  const completed = state.calls.filter((call) => call.resultHash);
  const hardLimit = positiveInteger(
    process.env.OCU_CLAUDE_MAX_CALLS_PER_TURN,
    30,
  );

  if (state.calls.length >= hardLimit) {
    deny(
      `OCU call budget reached (${hardLimit}) in this user turn. Stop OCU calls, report the unresolved state once, and wait for a new user instruction.`,
    );
  }

  const matching = completed.filter((call) => call.signature === signature);
  const lastTwo = matching.slice(-2);
  if (
    lastTwo.length === 2 &&
    lastTwo[0].resultHash === lastTwo[1].resultHash
  ) {
    deny(
      `OCU loop guard: ${tool} already produced the same result twice for identical input. Do not retry it or substitute another repetitive OCU call; report the unresolved state once.`,
    );
  }

  const lastTwoFailures = completed.slice(-2);
  if (
    lastTwoFailures.length === 2 &&
    lastTwoFailures.every((call) => call.failed)
  ) {
    deny(
      "OCU loop guard: two consecutive OCU calls failed. Stop OCU calls, report the latest concrete error once, and wait for changed instructions or environment.",
    );
  }

  state.calls.push({
    sequence: state.nextSequence,
    tool,
    signature,
    resultHash: null,
    failed: false,
  });
  state.nextSequence += 1;
  state.calls = state.calls.slice(-hardLimit);
  saveState(state);
}

function handlePostToolUse(forceFailed = false) {
  const state = loadState();
  const tool = shortToolName(input.tool_name);
  const signature = callSignature(tool, input.tool_input);
  const pending = [...state.calls]
    .reverse()
    .find((call) => call.signature === signature && !call.resultHash);

  if (!pending) {
    return;
  }

  const toolResult =
    input.tool_response ??
    input.tool_result ??
    input.tool_use_result ??
    input.error ??
    input.error_message ??
    null;
  pending.resultHash = resultHash(toolResult);
  pending.failed = forceFailed || resultFailed(toolResult);
  saveState(state);
}

function handleStop() {
  const state = loadState();
  const expected = state.exactFinalToken;
  if (!expected) {
    return;
  }

  const latest = latestAssistantText(input.transcript_path);
  if (latest === expected) {
    return;
  }

  const completed = state.calls.filter((call) => call.resultHash);
  if (
    completed.length === 0 ||
    completed.some((call) => call.failed) ||
    !latest.includes(expected)
  ) {
    return;
  }

  if (state.stopCorrections >= 1) {
    return;
  }

  state.stopCorrections += 1;
  saveState(state);
  const reason =
    `The user requested the exact final token ${expected}. Output ${expected} alone, with no summary, formatting, punctuation, or other text.`;
  process.stdout.write(
    `${JSON.stringify({
      decision: "block",
      reason,
      systemMessage: reason,
    })}\n`,
  );
}

function deny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
    systemMessage: reason,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exit(0);
}

function emptyState() {
  return {
    version: 1,
    nextSequence: 1,
    calls: [],
    exactFinalToken: null,
    stopCorrections: 0,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8"));
    if (
      parsed?.version === 1 &&
      Number.isInteger(parsed.nextSequence) &&
      Array.isArray(parsed.calls)
    ) {
      return parsed;
    }
  } catch {
    // A missing or interrupted state file starts a clean turn.
  }
  return emptyState();
}

function saveState(state) {
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, statePath);
}

async function readInput() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  if (!data.trim()) {
    return {};
  }
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function isOCUTool(toolName) {
  return /^mcp__plugin_open-computer-use_(?:open-computer-use|ocu)__/.test(
    toolName ?? "",
  );
}

function shortToolName(toolName) {
  return String(toolName ?? "").split("__").at(-1) ?? "unknown";
}

function callSignature(tool, toolInput) {
  return hash(`${tool}\n${stableStringify(toolInput ?? {})}`);
}

function resultHash(toolResult) {
  const text = stableStringify(toolResult ?? null).replace(
    /No accessibility changes since the previous presented state\.[^"]*/g,
    "NO_ACCESSIBILITY_CHANGES",
  );
  return hash(text);
}

function resultFailed(toolResult) {
  if (hasErrorFlag(toolResult)) {
    return true;
  }
  const text = stableStringify(toolResult ?? null);
  return /(?:^|["\s>])(?:Error:|<tool_use_error>|permission denied|failed with -\d+)/i.test(
    text,
  );
}

function hasErrorFlag(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (value.is_error === true || value.isError === true) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(hasErrorFlag);
  }
  return Object.values(value).some(hasErrorFlag);
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(value[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeSessionID(value) {
  const safe = String(value ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return safe.slice(0, 128) || "unknown";
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requestedExactFinalToken(prompt) {
  const text = String(prompt ?? "");
  const english =
    /\b(?:reply|respond|output)\s+exactly\s+["'`]?([A-Za-z0-9_:-]+)["'`]?/i.exec(
      text,
    );
  if (english) {
    return english[1];
  }
  const chinese =
    /只(?:回复|输出)[：:\s]*["'`]?([A-Za-z0-9_:-]+)["'`]?/.exec(text);
  return chinese?.[1] ?? null;
}

function latestAssistantText(transcriptPath) {
  if (!transcriptPath) {
    return "";
  }
  let data;
  try {
    data = readFileSync(transcriptPath, "utf8");
  } catch {
    return "";
  }

  let latest = "";
  for (const line of data.split(/\n+/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const message = event.message ?? event;
    if (event.type !== "assistant" && message.role !== "assistant") {
      continue;
    }
    const content = message.content;
    if (typeof content === "string") {
      latest = content.trim();
      continue;
    }
    if (!Array.isArray(content)) {
      continue;
    }
    const text = content
      .filter(
        (item) => item?.type === "text" && typeof item.text === "string",
      )
      .map((item) => item.text)
      .join("")
      .trim();
    if (text) {
      latest = text;
    }
  }
  return latest;
}
