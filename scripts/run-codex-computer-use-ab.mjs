#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const options = parseArgs(process.argv.slice(2));
const scenario = options.get("scenario") ?? "list-apps";
const repetitions = positiveInteger(options.get("repetitions") ?? "1", "repetitions");
const timeoutMs = positiveInteger(options.get("timeout-ms") ?? "180000", "timeout-ms");
const requestedArms = (options.get("arms") ?? "official,ocu")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const supportedScenarios = new Set(["list-apps", "fixture-basic"]);
const supportedArms = new Set(["official", "ocu"]);

if (!supportedScenarios.has(scenario)) {
  fail(`Unsupported scenario: ${scenario}. Use list-apps or fixture-basic.`);
}
if (
  requestedArms.length === 0 ||
  requestedArms.some((arm) => !supportedArms.has(arm))
) {
  fail("--arms must contain official, ocu, or both.");
}

const runId =
  options.get("run-id") ?? new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(repoRoot, "artifacts/harness-ab/runs", runId);
const baselineLauncher = path.join(repoRoot, "scripts/run-ocu-v1-baseline.sh");
const fixtureBundleIdentifier = "dev.opencomputeruse.fixture.ab";
mkdirSync(outputDir, { recursive: true });

if (!existsSync(baselineLauncher)) {
  fail(`Missing V1.0 launcher: ${baselineLauncher}`);
}

const results = [];
for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const armOrder = repetition % 2 === 1
    ? requestedArms
    : [...requestedArms].reverse();
  for (const arm of armOrder) {
    const expectedValue = `AB-FIXTURE-${String(repetition).padStart(2, "0")}`;
    const fixture = scenario === "fixture-basic" ? await startFixture() : null;
    try {
      const prompt = makePrompt({ arm, scenario, expectedValue });
      const processResult = await runProcess(codexSpec({ arm, prompt }));
      const parsed = parseCodexEvents(processResult.stdout, arm);
      const fixtureState = fixture ? readFixtureState() : null;
      const validation = validateRun({
        arm,
        scenario,
        expectedValue,
        processResult,
        parsed,
        fixtureState,
      });
      const result = {
        repetition,
        arm,
        scenario,
        success: validation.success,
        failures: validation.failures,
        durationMs: processResult.durationMs,
        exitCode: processResult.code,
        timedOut: processResult.timedOut,
        toolCalls: parsed.toolCalls,
        actionCalls: parsed.toolCalls.filter(
          (tool) => tool !== "get_app_state" && tool !== "list_apps",
        ),
        stateReads: parsed.toolCalls.filter((tool) => tool === "get_app_state").length,
        usage: parsed.usage,
        finalText: parsed.finalText,
        fixtureEvidence: summarizeFixture(fixtureState),
      };
      results.push(result);
      const stem = `${String(repetition).padStart(2, "0")}-${arm}`;
      writeFileSync(path.join(outputDir, `${stem}.stdout.jsonl`), processResult.stdout);
      writeFileSync(path.join(outputDir, `${stem}.stderr.log`), processResult.stderr);
      process.stdout.write(
        `${arm} run ${repetition}: ${result.success ? "PASS" : "FAIL"} ` +
          `(${result.durationMs}ms, tools=${result.toolCalls.join(",") || "none"})\n`,
      );
    } finally {
      await stopFixture(fixture);
    }
  }
}

const report = {
  schemaVersion: 1,
  runId,
  createdAt: new Date().toISOString(),
  sourceCommit: "54004e007dfb081754b3c03c93fb54696d3d35d4",
  scenario,
  repetitions,
  armOrderPolicy: "official-first on odd runs, reversed on even runs",
  environment: {
    codexVersion: commandOutput("codex", ["--version"]),
    harnessCommit: commandOutput("git", ["rev-parse", "HEAD"]),
    platform: process.platform,
    architecture: process.arch,
  },
  results,
  summary: summarizeResults(results),
};
const reportPath = path.join(outputDir, "summary.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
process.stdout.write(`Report: ${reportPath}\n`);
process.exit(report.summary.allPassed ? 0 : 1);

function parseArgs(argv) {
  const parsed = new Map();
  for (const arg of argv) {
    const [key, ...rest] = arg.split("=");
    if (key.startsWith("--")) {
      parsed.set(key.slice(2), rest.length > 0 ? rest.join("=") : "true");
    }
  }
  return parsed;
}

function positiveInteger(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`--${name} must be a positive integer.`);
  }
  return value;
}

function codexSpec({ arm, prompt }) {
  const args = [
    "exec",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    "--disable",
    "image_generation",
    "--json",
  ];
  if (arm === "official") {
    args.push(
      "-c",
      'plugins."computer-use@openai-bundled".enabled=true',
    );
  } else {
    args.push(
      "-c",
      'plugins."computer-use@openai-bundled".enabled=false',
      "-c",
      `mcp_servers.open-computer-use.command=${JSON.stringify(baselineLauncher)}`,
      "-c",
      'mcp_servers.open-computer-use.args=["mcp"]',
    );
  }
  args.push(prompt);
  return { command: "codex", args };
}

function makePrompt({ arm, scenario: scenarioId, expectedValue }) {
  const backend = arm === "official"
    ? "只使用 Codex 官方 computer-use 技能，并按技能要求通过 node_repl 调用 sky；不要使用 open-computer-use MCP"
    : "只使用 open-computer-use MCP；不要使用 node_repl、shell、浏览器或其他工具";
  if (scenarioId === "list-apps") {
    const finalText = arm === "official"
      ? "OFFICIAL_CU_AGENT_OK"
      : "OCU_V1_AGENT_OK";
    return `${backend}。调用 list_apps 恰好一次，不做截图和任何修改。完成后只回复 ${finalText}。`;
  }
  const finalText = arm === "official"
    ? "OFFICIAL_CU_FIXTURE_OK"
    : "OCU_V1_FIXTURE_OK";
  return [
    `${backend}。`,
    `操作本机应用 OpenComputerUseFixture，bundle identifier 是 ${fixtureBundleIdentifier}。`,
    "先读取最新状态。",
    `把文本框的值精确设置为 ${expectedValue}。`,
    "按 element_index 语义点击 Increment Counter 按钮恰好一次。",
    "再次读取状态，只有看到文本值正确且 Counter 为 1 才能判断完成。",
    `完成后只回复 ${finalText}。`,
  ].join("");
}

function runProcess(spec) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(spec.command, spec.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPEN_COMPUTER_USE_VISUAL_CURSOR: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3_000).unref();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: null,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}\n${error.message}`,
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

function parseCodexEvents(stdout, arm) {
  const toolCalls = [];
  let usage = null;
  let finalText = "";
  for (const line of stdout.split(/\n+/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "turn.completed") {
      usage = event.usage ?? null;
    }
    if (
      event.type === "item.completed" &&
      event.item?.type === "agent_message"
    ) {
      finalText = event.item.text ?? "";
    }
    if (
      event.type !== "item.completed" ||
      event.item?.type !== "mcp_tool_call" ||
      event.item?.status !== "completed"
    ) {
      continue;
    }
    if (arm === "ocu" && event.item.server === "open-computer-use") {
      toolCalls.push(event.item.tool);
      continue;
    }
    if (
      arm === "official" &&
      event.item.server === "node_repl" &&
      event.item.tool === "js"
    ) {
      const code = event.item.arguments?.code ?? "";
      const matches = code.matchAll(
        /\bsky\.(click|drag|get_app_state|list_apps|perform_secondary_action|press_key|scroll|select_text|set_value|type_text)\s*\(/g,
      );
      for (const match of matches) {
        toolCalls.push(match[1]);
      }
    }
  }
  return { toolCalls, usage, finalText };
}

function validateRun({
  arm,
  scenario: scenarioId,
  expectedValue,
  processResult,
  parsed,
  fixtureState,
}) {
  const failures = [];
  if (processResult.code !== 0) failures.push(`codex exited ${processResult.code}`);
  if (processResult.timedOut) failures.push("codex timed out");
  const expectedFinal = scenarioId === "list-apps"
    ? arm === "official" ? "OFFICIAL_CU_AGENT_OK" : "OCU_V1_AGENT_OK"
    : arm === "official" ? "OFFICIAL_CU_FIXTURE_OK" : "OCU_V1_FIXTURE_OK";
  if (parsed.finalText.trim() !== expectedFinal) {
    failures.push(`unexpected final response: ${parsed.finalText.trim()}`);
  }
  if (scenarioId === "list-apps") {
    const count = parsed.toolCalls.filter((tool) => tool === "list_apps").length;
    if (count !== 1) failures.push(`expected one list_apps call, saw ${count}`);
  } else {
    for (const required of ["get_app_state", "set_value", "click"]) {
      if (!parsed.toolCalls.includes(required)) {
        failures.push(`missing ${required} call`);
      }
    }
    if (parsed.toolCalls.filter((tool) => tool === "get_app_state").length < 2) {
      failures.push("missing post-action state verification");
    }
    const input = fixtureState?.elements?.find(
      (element) => element.identifier === "fixture-input",
    )?.value;
    const counter = fixtureState?.elements?.find(
      (element) => element.identifier === "fixture-counter-label",
    )?.value;
    if (input !== expectedValue) {
      failures.push(`fixture input mismatch: expected ${expectedValue}, got ${input}`);
    }
    if (counter !== "Counter: 1") {
      failures.push(`fixture counter mismatch: expected Counter: 1, got ${counter}`);
    }
  }
  return { success: failures.length === 0, failures };
}

function summarizeFixture(state) {
  if (!state) return null;
  const byId = Object.fromEntries(
    state.elements.map((element) => [element.identifier, element.value ?? element.title]),
  );
  return {
    focusedIdentifier: state.focusedIdentifier,
    input: byId["fixture-input"],
    counter: byId["fixture-counter-label"],
  };
}

function summarizeResults(allResults) {
  const byArm = {};
  for (const arm of requestedArms) {
    const armResults = allResults.filter((result) => result.arm === arm);
    byArm[arm] = {
      runs: armResults.length,
      successes: armResults.filter((result) => result.success).length,
      successRate: armResults.length === 0
        ? null
        : armResults.filter((result) => result.success).length / armResults.length,
      averageDurationMs: average(armResults.map((result) => result.durationMs)),
      averageToolCalls: average(armResults.map((result) => result.toolCalls.length)),
      averageInputTokens: average(
        armResults.map((result) => result.usage?.input_tokens).filter(Number.isFinite),
      ),
      averageOutputTokens: average(
        armResults.map((result) => result.usage?.output_tokens).filter(Number.isFinite),
      ),
    };
  }
  return {
    allPassed: allResults.length > 0 && allResults.every((result) => result.success),
    validRuns: allResults.length,
    byArm,
    interpretation: allResults.length < 30
      ? "descriptive-only; insufficient paired sample size for a parity claim"
      : "sample threshold reached; analyze confidence intervals before claiming parity",
  };
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function fixtureExecutablePath() {
  let rawExecutable = null;
  for (const relativePath of [
    ".build/release/OpenComputerUseFixture",
    ".build/debug/OpenComputerUseFixture",
  ]) {
    const candidate = path.join(repoRoot, relativePath);
    if (existsSync(candidate)) {
      rawExecutable = candidate;
      break;
    }
  }
  if (!rawExecutable) {
    const build = spawnSync(
      "swift",
      ["build", "-c", "release", "--product", "OpenComputerUseFixture"],
      { cwd: repoRoot, stdio: "inherit" },
    );
    if (build.status !== 0) fail("Failed to build OpenComputerUseFixture.");
    rawExecutable = path.join(repoRoot, ".build/release/OpenComputerUseFixture");
    if (!existsSync(rawExecutable)) {
      fail("OpenComputerUseFixture was not found after build.");
    }
  }

  const bundleRoot = path.join(
    repoRoot,
    ".build/ab-fixtures/OpenComputerUseFixture.app",
  );
  const bundleExecutable = path.join(
    bundleRoot,
    "Contents/MacOS/OpenComputerUseFixture",
  );
  mkdirSync(path.dirname(bundleExecutable), { recursive: true });
  copyFileSync(rawExecutable, bundleExecutable);
  chmodSync(bundleExecutable, 0o755);
  writeFileSync(
    path.join(bundleRoot, "Contents/Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>OpenComputerUseFixture</string>
<key>CFBundleIdentifier</key><string>${fixtureBundleIdentifier}</string>
<key>CFBundleName</key><string>OpenComputerUseFixture</string>
<key>CFBundleDisplayName</key><string>OpenComputerUseFixture</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
`,
  );
  return bundleExecutable;
}

function fixtureStatePath() {
  return path.join(os.tmpdir(), "open-computer-use-fixture", "state.json");
}

async function startFixture() {
  const stateDirectory = path.dirname(fixtureStatePath());
  rmSync(stateDirectory, { recursive: true, force: true });
  const child = spawn(fixtureExecutablePath(), [], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env },
  });
  child.fixtureStderr = "";
  child.stderr.on("data", (chunk) => {
    child.fixtureStderr += chunk;
  });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (existsSync(fixtureStatePath())) {
      try {
        readFixtureState();
        return child;
      } catch {}
    }
    await delay(100);
  }
  child.kill("SIGTERM");
  fail(`Fixture did not become ready. ${child.fixtureStderr.trim()}`);
}

async function stopFixture(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("close", resolve)),
    delay(2_000),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await delay(500);
}

function readFixtureState() {
  return JSON.parse(readFileSync(fixtureStatePath(), "utf8"));
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
