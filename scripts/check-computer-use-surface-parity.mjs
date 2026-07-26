#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const official = readJson(
  "tests/harness/baselines/codex-official-1.0.1000502.json",
);
const ocu = readJson("tests/harness/baselines/ocu-v1.0.json");
const officialSkillPath = expandHome(official.skillPath);
const officialSkill = readFileSync(officialSkillPath, "utf8");
const actualOfficialHash = sha256(officialSkill);

if (actualOfficialHash !== official.skillSha256) {
  throw new Error(
    `Official skill hash mismatch: expected ${official.skillSha256}, got ${actualOfficialHash}`,
  );
}

const typeBlock = officialSkill.match(/type Sky = \{([\s\S]*?)\n\};/);
if (!typeBlock) {
  throw new Error("Could not locate the official Sky API surface in SKILL.md.");
}
const actualOfficialTools = [...typeBlock[1].matchAll(/^\s{2}(\w+):/gm)]
  .map((match) => match[1])
  .filter((name) => name !== "target")
  .sort();
const expectedOfficialTools = [...official.expectedTools].sort();
if (JSON.stringify(actualOfficialTools) !== JSON.stringify(expectedOfficialTools)) {
  throw new Error(
    "Official Computer Use API surface no longer matches the frozen baseline.",
  );
}

const ocuTools = [...ocu.expectedTools].sort();
const officialSet = new Set(actualOfficialTools);
const ocuSet = new Set(ocuTools);
const shared = actualOfficialTools.filter((tool) => ocuSet.has(tool));
const missingFromOcu = actualOfficialTools.filter((tool) => !ocuSet.has(tool));
const extraInOcu = ocuTools.filter((tool) => !officialSet.has(tool));
const protocolSurfacePercent = Math.round(
  (shared.length / actualOfficialTools.length) * 100,
);

process.stdout.write(
  `${JSON.stringify(
    {
      status: missingFromOcu.length === 0 && extraInOcu.length === 0
        ? "parity"
        : "gap",
      official: {
        version: official.version,
        toolCount: actualOfficialTools.length,
        tools: actualOfficialTools,
      },
      ocu: {
        productVersion: ocu.productVersion,
        runtimeReportedVersion: ocu.runtimeReportedVersion,
        toolCount: ocuTools.length,
        tools: ocuTools,
      },
      shared,
      missingFromOcu,
      extraInOcu,
      protocolSurfacePercent,
      scoringNote:
        "Protocol surface coverage is not the overall Computer Use capability score.",
    },
    null,
    2,
  )}\n`,
);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function expandHome(filePath) {
  return filePath.startsWith("~/")
    ? path.join(os.homedir(), filePath.slice(2))
    : filePath;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
