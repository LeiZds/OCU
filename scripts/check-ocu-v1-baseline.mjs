#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const baselinePath = path.join(
  repoRoot,
  "tests/harness/baselines/ocu-v1.0.json",
);
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

assertHash(baseline.binaryPath, baseline.binarySha256);
assertHash(baseline.skillPath, baseline.skillSha256);

const probeText = execFileSync(
  path.join(repoRoot, "scripts/run-ocu-v1-baseline.sh"),
  ["--probe"],
  { cwd: repoRoot, encoding: "utf8", timeout: 15_000 },
);
const probe = JSON.parse(probeText);
const actualTools = probe.tools.map((tool) => tool.name).sort();
const expectedTools = [...baseline.expectedTools].sort();

if (JSON.stringify(actualTools) !== JSON.stringify(expectedTools)) {
  throw new Error(
    `V1.0 tool surface mismatch\nExpected: ${expectedTools.join(", ")}\nActual: ${actualTools.join(", ")}`,
  );
}

if (probe.serverInfo?.version !== baseline.runtimeReportedVersion) {
  throw new Error(
    `V1.0 runtime version mismatch: expected ${baseline.runtimeReportedVersion}, got ${probe.serverInfo?.version}`,
  );
}

if (probe.protocolVersion !== baseline.expectedProtocolVersion) {
  throw new Error(
    `V1.0 MCP protocol mismatch: expected ${baseline.expectedProtocolVersion}, got ${probe.protocolVersion}`,
  );
}

if (probe.instructionsLength !== baseline.expectedInstructionsLength) {
  throw new Error(
    `V1.0 instructions length mismatch: expected ${baseline.expectedInstructionsLength}, got ${probe.instructionsLength}`,
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "ok",
      productVersion: baseline.productVersion,
      sourceCommit: baseline.sourceCommit,
      serverInfo: probe.serverInfo,
      protocolVersion: probe.protocolVersion,
      instructionsLength: probe.instructionsLength,
      toolCount: probe.toolCount,
      tools: actualTools,
    },
    null,
    2,
  )}\n`,
);

function assertHash(relativePath, expected) {
  const absolutePath = path.join(repoRoot, relativePath);
  const actual = createHash("sha256")
    .update(readFileSync(absolutePath))
    .digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Hash mismatch for ${relativePath}: expected ${expected}, got ${actual}`,
    );
  }
}
