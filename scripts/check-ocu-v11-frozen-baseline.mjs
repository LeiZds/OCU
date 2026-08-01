#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(
    path.join(repoRoot, "tests/harness/baselines/ocu-v1.1-frozen.json"),
    "utf8",
  ),
);

assertEqual(gitText("rev-parse", `${manifest.tag}^{}`), manifest.commit, "tag commit");
assertEqual(
  gitText("rev-parse", `${manifest.commit}:packages/OpenComputerUseKit`),
  manifest.runtimeTreeGitObject,
  "runtime tree",
);

const trackedFiles = {
  skill: "skills/open-computer-use/SKILL.md",
  binary: "dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse",
  versionSource:
    "packages/OpenComputerUseKit/Sources/OpenComputerUseKit/OpenComputerUseVersion.swift",
};
for (const [name, file] of Object.entries(trackedFiles)) {
  const content = gitBuffer("show", `${manifest.commit}:${file}`);
  const digest = createHash("sha256").update(content).digest("hex");
  assertEqual(digest, manifest.sha256[name], `${name} SHA-256`);
}

process.stdout.write(`${JSON.stringify({
  status: "ok",
  version: manifest.version,
  tag: manifest.tag,
  commit: manifest.commit,
  runtimeTreeGitObject: manifest.runtimeTreeGitObject,
  sha256: manifest.sha256,
}, null, 2)}\n`);

function gitText(...args) {
  return gitBuffer(...args).toString("utf8").trim();
}

function gitBuffer(...args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr?.toString("utf8") ?? "git failed\n");
    process.exit(result.status ?? 2);
  }
  return result.stdout;
}

function assertEqual(actual, expected, label) {
  if (actual === expected) return;
  process.stderr.write(`${label} mismatch: expected ${expected}, got ${actual}\n`);
  process.exit(1);
}
