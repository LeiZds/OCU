#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const candidateVersion = options.get("candidate") ?? "v1.1";
const invalidRetries = nonNegativeInteger(
  options.get("invalid-retries") ?? "1",
  "invalid-retries",
);
const requestedArms = (options.get("arms") ?? "official,ocu")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const supportedScenarios = new Set([
  "list-apps",
  "fixture-basic",
  "focus-unicode",
  "select-text",
  "long-page-scroll",
]);
const supportedArms = new Set(["official", "ocu"]);
const supportedCandidates = new Set(["v1.0", "v1.1"]);

if (!supportedScenarios.has(scenario)) {
  fail(
    `Unsupported scenario: ${scenario}. Use list-apps, fixture-basic, focus-unicode, select-text, or long-page-scroll.`,
  );
}
if (
  requestedArms.length === 0 ||
  requestedArms.some((arm) => !supportedArms.has(arm))
) {
  fail("--arms must contain official, ocu, or both.");
}
if (!supportedCandidates.has(candidateVersion)) {
  fail("--candidate must be v1.0 or v1.1.");
}

const runId =
  options.get("run-id") ?? new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(repoRoot, "artifacts/harness-ab/runs", runId);
const candidateLauncher = candidateVersion === "v1.0"
  ? path.join(repoRoot, "scripts/run-ocu-v1-baseline.sh")
  : path.join(repoRoot, "scripts/launch-open-computer-use-codex-ab.sh");
const officialBaselinePath = path.join(
  repoRoot,
  "tests/harness/baselines/codex-official-1.0.1000502.json",
);
const officialBaseline = JSON.parse(readFileSync(officialBaselinePath, "utf8"));
const officialSkillPath = expandHomePath(officialBaseline.skillPath);
const officialPluginRoot = path.dirname(path.dirname(path.dirname(officialSkillPath)));
const officialWrapperPath = path.join(
  officialPluginRoot,
  "scripts/computer-use-client.mjs",
);
const fixtureBundleIdentifier = "dev.opencomputeruse.fixture.ab";
const fixtureAppName = "CodexABFixture";
const fixtureAppPath = path.join(
  repoRoot,
  `.build/ab-fixtures/${fixtureAppName}.app`,
);
mkdirSync(outputDir, { recursive: true });

if (!existsSync(candidateLauncher)) {
  fail(`Missing ${candidateVersion} launcher: ${candidateLauncher}`);
}
if (!existsSync(officialSkillPath) || !existsSync(officialWrapperPath)) {
  fail(
    `Missing pinned Codex official Computer Use ${officialBaseline.version} at ${officialPluginRoot}.`,
  );
}
const candidateIdentity = prepareCandidate();

const results = [];
for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  const armOrder = repetition % 2 === 1
    ? requestedArms
    : [...requestedArms].reverse();
  for (const arm of armOrder) {
    const expectedValue = `AB-FIXTURE-${String(repetition).padStart(2, "0")}`;
    for (let attempt = 1; attempt <= invalidRetries + 1; attempt += 1) {
      const fixture = scenario === "list-apps" ? null : await startFixture();
      let result;
      try {
        const prompt = makePrompt({ arm, scenario, expectedValue });
        const processResult = await runProcess(codexSpec({ arm, prompt }));
        const parsed = parseCodexEvents(processResult.stdout, arm);
        if (fixture) await delay(650);
        const fixtureState = fixture ? readFixtureState() : null;
        const validation = validateRun({
          arm,
          scenario,
          expectedValue,
          processResult,
          parsed,
          fixtureState,
        });
        result = {
          repetition,
          attempt,
          arm,
          scenario,
          valid: validation.valid,
          success: validation.success,
          taskCompleted: validation.taskCompleted,
          methodConformance: validation.methodConformance,
          failures: validation.failures,
          durationMs: processResult.durationMs,
          exitCode: processResult.code,
          timedOut: processResult.timedOut,
          resourceUsage: processResult.resourceUsage,
          transportOutputBytes: Buffer.byteLength(processResult.stdout),
          toolResultTextBytes: parsed.toolResultTextBytes,
          toolResultImageBase64Bytes: parsed.toolResultImageBase64Bytes,
          toolCalls: parsed.toolCalls,
          successfulToolCalls: parsed.successfulToolCalls,
          failedToolCalls: parsed.failedToolCalls,
          actionCalls: parsed.toolCalls.filter(
            (tool) => tool !== "get_app_state" && tool !== "list_apps",
          ),
          stateReads: parsed.successfulToolCalls.filter(
            (tool) => tool === "get_app_state"
          ).length,
          usage: parsed.usage,
          finalText: parsed.finalText,
          fixtureEvidence: summarizeFixture(fixtureState),
        };
        results.push(result);
        const stem = `${String(repetition).padStart(2, "0")}-${arm}-attempt-${String(attempt).padStart(2, "0")}`;
        writeFileSync(path.join(outputDir, `${stem}.stdout.jsonl`), processResult.stdout);
        writeFileSync(path.join(outputDir, `${stem}.stderr.log`), processResult.stderr);
        process.stdout.write(
          `${arm} run ${repetition} attempt ${attempt}: ` +
            `${!result.valid ? "INVALID" : result.success ? "PASS" : "FAIL"} ` +
            `(${result.durationMs}ms, tools=${result.toolCalls.join(",") || "none"})\n`,
        );
      } finally {
        await stopFixture(fixture);
      }
      if (result.valid) break;
    }
  }
}

const report = {
  schemaVersion: 1,
  runId,
  createdAt: new Date().toISOString(),
  sourceCommit: commandOutput("git", ["rev-parse", "HEAD"]),
  candidate: candidateIdentity,
  scenario,
  repetitions,
  armOrderPolicy: "official-first on odd runs, reversed on even runs",
  invalidRetryPolicy: `retry infrastructure-invalid runs up to ${invalidRetries} time(s)`,
  environment: {
    codexVersion: commandOutput("codex", ["--version"]),
    harnessCommit: commandOutput("git", ["rev-parse", "HEAD"]),
    platform: process.platform,
    architecture: process.arch,
    configIsolation: {
      official: `normal user config for node_repl; pinned Computer Use ${officialBaseline.version} wrapper path is supplied in the prompt`,
      ocu: `--ignore-user-config plus only the ${candidateVersion} OCU MCP override`,
    },
    fixtureMode: scenario === "list-apps"
      ? null
      : "real Accessibility path; app name differs from OCU FixtureBridge.appName",
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

function nonNegativeInteger(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    fail(`--${name} must be a non-negative integer.`);
  }
  return value;
}

function expandHomePath(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function prepareCandidate() {
  if (candidateVersion === "v1.0") {
    const check = spawnSync(
      process.execPath,
      [path.join(scriptDir, "check-ocu-v1-baseline.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (check.status !== 0) {
      fail(`V1.0 baseline preflight failed: ${check.stderr || check.stdout}`);
    }
    const baseline = JSON.parse(
      readFileSync(
        path.join(repoRoot, "tests/harness/baselines/ocu-v1.0.json"),
        "utf8",
      ),
    );
    return {
      productVersion: "1.0.0",
      runtimeVersion: baseline.runtimeReportedVersion,
      sourceCommit: baseline.sourceCommit,
      binarySha256: baseline.binarySha256,
      skillSha256: baseline.skillSha256,
      toolCount: baseline.expectedTools.length,
      launcher: path.relative(repoRoot, candidateLauncher),
    };
  }

  const dirty = commandOutput("git", ["status", "--porcelain"]);
  if (dirty && options.get("allow-dirty") !== "true") {
    fail(
      "V1.1 candidate worktree is dirty. Commit the candidate first, or use --allow-dirty=true only for runner debugging.",
    );
  }

  const build = spawnSync(
    "swift",
    ["build", "-c", "release", "--product", "OpenComputerUse"],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (build.status !== 0) {
    fail("Failed to build the V1.1 candidate runtime.");
  }

  const binary = path.join(repoRoot, ".build/release/OpenComputerUse");
  if (!existsSync(binary)) {
    fail(`V1.1 candidate binary is missing: ${binary}`);
  }

  const probe = spawnSync(
    process.execPath,
    [
      path.join(scriptDir, "probe-mcp-tools.mjs"),
      "--timeout-ms",
      "15000",
      "--",
      candidateLauncher,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 20_000,
      env: {
        ...process.env,
        OPEN_COMPUTER_USE_VISUAL_CURSOR: "0",
      },
    },
  );
  if (probe.status !== 0) {
    fail(`V1.1 candidate MCP preflight failed: ${probe.stderr || probe.stdout}`);
  }
  const identity = JSON.parse(probe.stdout);
  const expectedProfile =
    "Profile: host=codex;model=gpt;binding=codex-gpt.";
  if (
    identity.serverInfo?.version !== "1.1.0-dev.1" ||
    identity.toolCount !== 10 ||
    !identity.instructions.includes(expectedProfile)
  ) {
    fail(
      `V1.1 candidate identity mismatch: ${JSON.stringify({
        serverInfo: identity.serverInfo,
        toolCount: identity.toolCount,
        expectedProfilePresent: identity.instructions.includes(expectedProfile),
      })}`,
    );
  }

  return {
    productVersion: "1.1.0-dev.1",
    runtimeVersion: identity.serverInfo.version,
    sourceCommit: commandOutput("git", ["rev-parse", "HEAD"]),
    binarySha256: sha256File(binary),
    skillSha256: sha256File(
      path.join(repoRoot, "skills/open-computer-use/SKILL.md"),
    ),
    toolCount: identity.toolCount,
    instructionsBytes: identity.instructionsBytes,
    profile: expectedProfile,
    launcher: path.relative(repoRoot, candidateLauncher),
  };
}

function codexSpec({ arm, prompt }) {
  const args = [
    "exec",
    "--ignore-rules",
    "--ephemeral",
    "--model",
    "gpt-5.6-sol",
    "-c",
    'model_reasoning_effort="high"',
  ];
  if (arm === "official") {
    args.push(
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "--disable",
      "image_generation",
      "--json",
      "-c",
      'plugins."computer-use@openai-bundled".enabled=true',
    );
  } else {
    args.push(
      "--ignore-user-config",
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "--disable",
      "image_generation",
      "--disable",
      "js_repl",
      "--json",
      "-c",
      'plugins."computer-use@openai-bundled".enabled=false',
      "-c",
      `mcp_servers.open-computer-use.command=${JSON.stringify(candidateLauncher)}`,
      "-c",
      'mcp_servers.open-computer-use.args=["mcp"]',
    );
  }
  args.push(prompt);
  return { command: "codex", args };
}

function makePrompt({ arm, scenario: scenarioId, expectedValue }) {
  const backend = arm === "official"
    ? [
      "Use only the Codex official computer-use runtime through node_repl and sky. Do not use open-computer-use MCP or any other UI backend",
      `In node_repl initialize it exactly with: if (!globalThis.sky) { const { setupComputerUseRuntime } = await import(${JSON.stringify(officialWrapperPath)}); await setupComputerUseRuntime({ globals: globalThis }); }`,
    ].join(". ")
    : "Use only open-computer-use MCP tools. Do not use node_repl, terminal, shell, browser, file, or any other tool";
  const appReference = arm === "official" ? fixtureAppPath : fixtureBundleIdentifier;
  const stateRead = arm === "ocu"
    ? `Call get_app_state for app ${appReference} with disable_screenshot=true`
    : `Call get_app_state for app ${appReference}`;
  if (scenarioId === "list-apps") {
    const finalText = arm === "official"
      ? "OFFICIAL_CU_AGENT_OK"
      : "OCU_CANDIDATE_AGENT_OK";
    return [
      `${backend}.`,
      "Call list_apps exactly once. Do not capture a screenshot or change anything.",
      `After the tool call, reply exactly ${finalText}.`,
    ].join(" ");
  }
  const finalText = arm === "official"
    ? scenarioId === "focus-unicode"
      ? "OFFICIAL_CU_UNICODE_OK"
      : scenarioId === "select-text"
        ? "OFFICIAL_CU_SELECT_OK"
      : scenarioId === "long-page-scroll"
        ? "OFFICIAL_CU_SCROLL_OK"
      : "OFFICIAL_CU_FIXTURE_OK"
    : scenarioId === "focus-unicode"
      ? "OCU_CANDIDATE_UNICODE_OK"
      : scenarioId === "select-text"
        ? "OCU_CANDIDATE_SELECT_OK"
      : scenarioId === "long-page-scroll"
        ? "OCU_CANDIDATE_SCROLL_OK"
      : "OCU_CANDIDATE_FIXTURE_OK";
  if (scenarioId === "focus-unicode") {
    const initialValue = `${expectedValue}-中文🙂é`;
    return [
      `${backend}. Operate the local app ${fixtureAppName}; its test reference is ${appReference}.`,
      `${stateRead}.`,
      `Use set_value to set the text field exactly to ${JSON.stringify(initialValue)}.`,
      "Click that text field using the integer element_index from the latest state so it has focus.",
      `Use type_text to append exactly ${JSON.stringify("｜追加")}.`,
      `${stateRead} again. Only finish after the text field is exactly ${JSON.stringify(`${initialValue}｜追加`)} and Counter is still 0.`,
      `Reply exactly ${finalText}.`,
    ].join(" ");
  }
  if (scenarioId === "long-page-scroll") {
    return [
      `${backend}. Operate the local app ${fixtureAppName}; its test reference is ${appReference}.`,
      `${stateRead}.`,
      "In the returned accessibility text, locate the scroll area whose ID is fixture-scroll-view.",
      "Use the integer element index shown at the start of that current row as scroll.element_index; never pass the ID string as element_index.",
      "Call scroll with direction down and pages 1.",
      `${stateRead} again. Only finish after Scroll offset is no longer 0.`,
      `Reply exactly ${finalText}.`,
    ].join(" ");
  }
  if (scenarioId === "select-text") {
    const selectionValue = `${expectedValue} first value / second value end`;
    return [
      `${backend}. Operate the local app ${fixtureAppName}; its test reference is ${appReference}.`,
      `${stateRead}.`,
      `Use set_value to set the text field exactly to ${JSON.stringify(selectionValue)}.`,
      "Use select_text on that editable field to select the second occurrence of value.",
      "Disambiguate it with prefix \"second \" and suffix \" end\", and use selection_type text.",
      `${stateRead} again. Only finish after the input value is unchanged, Counter is still 0, and the state reports Selected text: [value].`,
      `Reply exactly ${finalText}.`,
    ].join(" ");
  }
  return [
    `${backend}. Operate the local app ${fixtureAppName}; its test reference is ${appReference}.`,
    `${stateRead}.`,
    `Use set_value to set the text field exactly to ${JSON.stringify(expectedValue)}.`,
    "Click the Increment Counter button exactly once using the integer element_index from the latest state.",
    `${stateRead} again. Only finish after the text field is correct and Counter is 1.`,
    `Reply exactly ${finalText}.`,
  ].join(" ");
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
    const resourceSampler = startResourceSampler(child.pid);
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
        resourceUsage: resourceSampler.stop(),
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
        resourceUsage: resourceSampler.stop(),
        stdout,
        stderr,
      });
    });
  });
}

function startResourceSampler(rootPid) {
  const samples = [];
  let stopped = false;
  const capture = () => {
    const sample = sampleProcessTree(rootPid);
    if (sample) samples.push(sample);
  };
  capture();
  const timer = setInterval(capture, 500);

  return {
    stop() {
      if (stopped) return summarizeResourceSamples(samples);
      stopped = true;
      clearInterval(timer);
      capture();
      return summarizeResourceSamples(samples);
    },
  };
}

function sampleProcessTree(rootPid) {
  const result = spawnSync(
    "/bin/ps",
    ["-axo", "pid=,ppid=,%cpu=,rss=,command="],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;

  const processes = result.stdout
    .split("\n")
    .map((line) => {
      const match = line.match(
        /^\s*(\d+)\s+(\d+)\s+([0-9.]+)\s+(\d+)\s+(.*)$/,
      );
      if (!match) return null;
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        cpuPercent: Number(match[3]),
        rssKb: Number(match[4]),
        command: match[5],
      };
    })
    .filter(Boolean);

  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const process of processes) {
      if (!descendants.has(process.pid) && descendants.has(process.ppid)) {
        descendants.add(process.pid);
        changed = true;
      }
    }
  }
  const tree = processes.filter((process) => descendants.has(process.pid));
  if (tree.length === 0) return null;

  return {
    timestampMs: Date.now(),
    processCount: tree.length,
    cpuPercent: tree.reduce((sum, process) => sum + process.cpuPercent, 0),
    rssKb: tree.reduce((sum, process) => sum + process.rssKb, 0),
    ocuProcessCount: tree.filter((process) =>
      process.pid !== rootPid &&
      (
        /\/OpenComputerUse(?:\s|$)/.test(process.command) ||
        /\/(?:run-ocu-v1-baseline|launch-open-computer-use-(?:codex|claude))\.sh(?:\s|$)/.test(
          process.command,
        )
      )
    ).length,
  };
}

function summarizeResourceSamples(samples) {
  if (samples.length === 0) {
    return {
      samples: 0,
      peakProcessCount: null,
      peakCpuPercent: null,
      averageCpuPercent: null,
      peakRssKb: null,
      peakOcuProcessCount: null,
    };
  }

  return {
    samples: samples.length,
    peakProcessCount: Math.max(...samples.map((sample) => sample.processCount)),
    peakCpuPercent: roundOne(
      Math.max(...samples.map((sample) => sample.cpuPercent)),
    ),
    averageCpuPercent: roundOne(
      samples.reduce((sum, sample) => sum + sample.cpuPercent, 0) /
        samples.length,
    ),
    peakRssKb: Math.max(...samples.map((sample) => sample.rssKb)),
    peakOcuProcessCount: Math.max(
      ...samples.map((sample) => sample.ocuProcessCount),
    ),
  };
}

function parseCodexEvents(stdout, arm) {
  const toolCalls = [];
  const successfulToolCalls = [];
  const failedToolCalls = [];
  const callRecords = [];
  let usage = null;
  let finalText = "";
  let toolResultTextBytes = 0;
  let toolResultImageBase64Bytes = 0;
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
      event.item?.type !== "mcp_tool_call"
    ) {
      continue;
    }
    if (arm === "ocu" && event.item.server === "open-computer-use") {
      const completed = event.item.status === "completed";
      const resultContent = event.item.result?.content ?? [];
      toolResultTextBytes += resultContent
        .filter((item) => item?.type === "text" && typeof item.text === "string")
        .reduce((sum, item) => sum + Buffer.byteLength(item.text), 0);
      toolResultImageBase64Bytes += resultContent
        .filter((item) => item?.type === "image" && typeof item.data === "string")
        .reduce((sum, item) => sum + Buffer.byteLength(item.data), 0);
      toolCalls.push(event.item.tool);
      (completed ? successfulToolCalls : failedToolCalls).push(event.item.tool);
      callRecords.push({
        tools: [event.item.tool],
        completed,
        resultText: resultTextFrom(event.item.result),
      });
      continue;
    }
    if (
      arm === "official" &&
      event.item.server === "node_repl" &&
      event.item.tool === "js"
    ) {
      const code = event.item.arguments?.code ?? "";
      const resultContent = event.item.result?.content ?? [];
      toolResultTextBytes += resultContent
        .filter((item) => item?.type === "text" && typeof item.text === "string")
        .reduce((sum, item) => sum + Buffer.byteLength(item.text), 0);
      toolResultImageBase64Bytes += resultContent
        .filter((item) => item?.type === "image" && typeof item.data === "string")
        .reduce((sum, item) => sum + Buffer.byteLength(item.data), 0);
      const recordTools = [...code.matchAll(
        /\bsky\.(click|drag|get_app_state|list_apps|perform_secondary_action|press_key|scroll|select_text|set_value|type_text)\s*\(/g,
      )].map((match) => match[1]);
      for (const tool of recordTools) {
        toolCalls.push(tool);
        (event.item.status === "completed" ? successfulToolCalls : failedToolCalls).push(tool);
      }
      if (recordTools.length > 0) {
        callRecords.push({
          tools: recordTools,
          completed: event.item.status === "completed",
          resultText: resultTextFrom(event.item.result),
        });
      }
    }
  }
  return {
    toolCalls,
    successfulToolCalls,
    failedToolCalls,
    callRecords,
    usage,
    finalText,
    toolResultTextBytes,
    toolResultImageBase64Bytes,
  };
}

function validateRun({
  arm,
  scenario: scenarioId,
  expectedValue,
  processResult,
  parsed,
  fixtureState,
}) {
  const taskFailures = [];
  const methodFailures = [];
  const processOutput = `${processResult.stdout}\n${processResult.stderr}`;
  const infrastructureFailure = [
    /You've hit your usage limit/i,
    /try again at .+usage/i,
    /rate limit(?:ed| exceeded)?/i,
    /insufficient quota/i,
  ].find((pattern) => pattern.test(processOutput));
  if (infrastructureFailure) {
    return {
      valid: false,
      success: false,
      taskCompleted: false,
      methodConformance: false,
      failures: ["Codex test infrastructure was unavailable because its usage limit was reached"],
    };
  }
  const backendUnavailable = parsed.toolCalls.length === 0 && (
    arm === "ocu"
      ? /未提供\s*open-computer-use|open-computer-use.+not (?:available|provided)/i.test(
        parsed.finalText,
      )
      : /未提供.+(?:computer-use|node_repl|sky)|(?:computer-use|node_repl|sky).+not (?:available|provided)/i.test(
        parsed.finalText,
      )
  );
  if (backendUnavailable) {
    return {
      valid: false,
      success: false,
      taskCompleted: false,
      methodConformance: false,
      failures: ["requested Computer Use backend was not injected into the Codex task"],
    };
  }
  if (processResult.code !== 0) taskFailures.push(`codex exited ${processResult.code}`);
  if (processResult.timedOut) taskFailures.push("codex timed out");
  const expectedFinal = scenarioId === "list-apps"
    ? arm === "official" ? "OFFICIAL_CU_AGENT_OK" : "OCU_CANDIDATE_AGENT_OK"
    : scenarioId === "focus-unicode"
      ? arm === "official" ? "OFFICIAL_CU_UNICODE_OK" : "OCU_CANDIDATE_UNICODE_OK"
      : scenarioId === "select-text"
        ? arm === "official" ? "OFFICIAL_CU_SELECT_OK" : "OCU_CANDIDATE_SELECT_OK"
      : scenarioId === "long-page-scroll"
        ? arm === "official" ? "OFFICIAL_CU_SCROLL_OK" : "OCU_CANDIDATE_SCROLL_OK"
      : arm === "official" ? "OFFICIAL_CU_FIXTURE_OK" : "OCU_CANDIDATE_FIXTURE_OK";
  if (parsed.finalText.trim() !== expectedFinal) {
    methodFailures.push(`unexpected final response: ${parsed.finalText.trim()}`);
  }
  if (scenarioId === "list-apps") {
    const count = parsed.successfulToolCalls.filter((tool) => tool === "list_apps").length;
    if (count !== 1) taskFailures.push(`expected one list_apps call, saw ${count}`);
  } else {
    const requiredTools = scenarioId === "focus-unicode"
      ? ["get_app_state", "set_value", "click", "type_text"]
      : scenarioId === "select-text"
        ? ["get_app_state", "set_value", "select_text"]
      : scenarioId === "long-page-scroll"
        ? ["get_app_state", "scroll"]
        : ["get_app_state", "set_value", "click"];
    for (const required of requiredTools) {
      if (!parsed.toolCalls.includes(required)) {
        methodFailures.push(`missing ${required} call`);
      }
    }
    if (parsed.successfulToolCalls.filter((tool) => tool === "get_app_state").length < 2) {
      methodFailures.push("missing post-action state verification");
    }
    const input = fixtureState?.elements?.find(
      (element) => element.identifier === "fixture-input",
    )?.value;
    const counter = fixtureState?.elements?.find(
      (element) => element.identifier === "fixture-counter-label",
    )?.value;
    const expectedInput = scenarioId === "focus-unicode"
      ? `${expectedValue}-中文🙂é｜追加`
      : scenarioId === "select-text"
        ? `${expectedValue} first value / second value end`
      : scenarioId === "long-page-scroll" ? "seed" : expectedValue;
    if (input !== expectedInput) {
      taskFailures.push(
        `fixture input mismatch: expected ${expectedInput}, got ${input}`,
      );
    }
    const expectedCounter = scenarioId === "focus-unicode" ||
        scenarioId === "select-text" ||
        scenarioId === "long-page-scroll"
      ? "Counter: 0"
      : "Counter: 1";
    if (counter !== expectedCounter) {
      taskFailures.push(
        `fixture counter mismatch: expected ${expectedCounter}, got ${counter}`,
      );
    }
    if (scenarioId === "focus-unicode") {
      const typeTextRecordIndex = parsed.callRecords.findIndex((record) =>
        record.completed && record.tools.includes("type_text")
      );
      const firstVerification = typeTextRecordIndex === -1
        ? null
        : parsed.callRecords
          .slice(typeTextRecordIndex)
          .find((record) => record.completed && record.tools.includes("get_app_state"));
      if (!firstVerification?.resultText.includes(expectedInput)) {
        methodFailures.push(
          "type_text did not produce the expected text at the first post-action verification",
        );
      }
    }
    if (scenarioId === "select-text" && fixtureState?.selectedText !== "value") {
      taskFailures.push(
        `fixture selected text mismatch: expected value, got ${fixtureState?.selectedText}`,
      );
    }
    if (
      scenarioId === "long-page-scroll" &&
      fixtureState?.elements?.find(
        (element) => element.identifier === "fixture-scroll-status",
      )?.value === "Scroll offset: 0"
    ) {
      taskFailures.push("fixture scroll offset remained 0");
    }
  }
  return {
    valid: true,
    success: taskFailures.length === 0 && methodFailures.length === 0,
    taskCompleted: taskFailures.length === 0,
    methodConformance: methodFailures.length === 0,
    failures: [...taskFailures, ...methodFailures],
  };
}

function summarizeFixture(state) {
  if (!state) return null;
  const byId = Object.fromEntries(
    state.elements.map((element) => [element.identifier, element.value ?? element.title]),
  );
  return {
    focusedIdentifier: state.focusedIdentifier,
    selectedText: state.selectedText ?? null,
    input: byId["fixture-input"],
    counter: byId["fixture-counter-label"],
    scroll: byId["fixture-scroll-status"],
  };
}

function summarizeResults(allResults) {
  const byArm = {};
  for (const arm of requestedArms) {
    const armResults = allResults.filter((result) => result.arm === arm);
    const validArmResults = armResults.filter((result) => result.valid);
    byArm[arm] = {
      runs: armResults.length,
      validRuns: validArmResults.length,
      invalidRuns: armResults.length - validArmResults.length,
      successes: validArmResults.filter((result) => result.success).length,
      taskCompletions: validArmResults.filter((result) => result.taskCompleted).length,
      methodConformances: validArmResults.filter((result) => result.methodConformance).length,
      successRate: validArmResults.length === 0
        ? null
        : validArmResults.filter((result) => result.success).length / validArmResults.length,
      averageDurationMs: average(validArmResults.map((result) => result.durationMs)),
      averageToolCalls: average(validArmResults.map((result) => result.toolCalls.length)),
      averageActionCalls: average(validArmResults.map((result) => result.actionCalls.length)),
      averageStateReads: average(validArmResults.map((result) => result.stateReads)),
      averageToolResultTextBytes: average(
        validArmResults.map((result) => result.toolResultTextBytes),
      ),
      averageToolResultImageBase64Bytes: average(
        validArmResults.map((result) => result.toolResultImageBase64Bytes),
      ),
      averageTransportOutputBytes: average(
        validArmResults.map((result) => result.transportOutputBytes),
      ),
      averagePeakCpuPercent: average(
        validArmResults
          .map((result) => result.resourceUsage?.peakCpuPercent)
          .filter(Number.isFinite),
      ),
      averageCpuPercent: average(
        validArmResults
          .map((result) => result.resourceUsage?.averageCpuPercent)
          .filter(Number.isFinite),
      ),
      averagePeakRssKb: average(
        validArmResults
          .map((result) => result.resourceUsage?.peakRssKb)
          .filter(Number.isFinite),
      ),
      maximumOcuProcessCount: validArmResults.length === 0
        ? null
        : Math.max(
          ...validArmResults.map(
            (result) => result.resourceUsage?.peakOcuProcessCount ?? 0,
          ),
        ),
      averageInputTokens: average(
        validArmResults.map((result) => result.usage?.input_tokens).filter(Number.isFinite),
      ),
      averageOutputTokens: average(
        validArmResults.map((result) => result.usage?.output_tokens).filter(Number.isFinite),
      ),
    };
  }
  const validResults = allResults.filter((result) => result.valid);
  const hasCompletePairs = requestedArms.every((arm) =>
    validResults.filter((result) => result.arm === arm).length === repetitions
  );
  return {
    allPassed: hasCompletePairs && validResults.every((result) => result.success),
    validRuns: validResults.length,
    invalidRuns: allResults.length - validResults.length,
    hasCompletePairs,
    byArm,
    interpretation: validResults.length < 30
      ? "descriptive-only; insufficient paired sample size for a parity claim"
      : "sample threshold reached; analyze confidence intervals before claiming parity",
  };
}

function resultTextFrom(result) {
  return (result?.content ?? [])
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function fixtureExecutablePath() {
  if (fixtureExecutablePath.cached) {
    return fixtureExecutablePath.cached;
  }
  const build = spawnSync(
    "swift",
    ["build", "-c", "release", "--product", "OpenComputerUseFixture"],
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (build.status !== 0) fail("Failed to build OpenComputerUseFixture.");
  const rawExecutable = path.join(
    repoRoot,
    ".build/release/OpenComputerUseFixture",
  );
  if (!existsSync(rawExecutable)) {
    fail("OpenComputerUseFixture was not found after build.");
  }

  const bundleRoot = path.join(
    repoRoot,
    `.build/ab-fixtures/${fixtureAppName}.app`,
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
<key>CFBundleName</key><string>${fixtureAppName}</string>
<key>CFBundleDisplayName</key><string>${fixtureAppName}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
`,
  );
  fixtureExecutablePath.cached = bundleExecutable;
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
        await delay(650);
        const settledState = readFixtureState();
        const scrollStatus = settledState.elements?.find(
          (element) => element.identifier === "fixture-scroll-status",
        )?.value;
        if (scrollStatus !== "Scroll offset: 0") {
          child.kill("SIGTERM");
          fail(
            `Fixture initial scroll invariant failed: expected Scroll offset: 0, got ${scrollStatus}.`,
          );
        }
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

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
