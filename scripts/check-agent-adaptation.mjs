#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const binary = process.argv[2] ?? path.join(repoRoot, ".build/release/OpenComputerUse");

if (!existsSync(binary)) {
  throw new Error(`Missing OpenComputerUse binary: ${binary}`);
}

const expectedTools = [
  "click",
  "drag",
  "get_app_state",
  "list_apps",
  "perform_secondary_action",
  "press_key",
  "scroll",
  "select_text",
  "set_value",
  "type_text",
].sort();
const elementTools = [
  "click",
  "perform_secondary_action",
  "scroll",
  "select_text",
  "set_value",
];
const hosts = ["generic", "codex", "claude-code", "workbuddy"];
const models = ["generic", "gpt", "deepseek"];
const results = [];

for (const host of hosts) {
  for (const model of models) {
    const probe = JSON.parse(
      execFileSync(
        process.execPath,
        [
          path.join(scriptDir, "probe-mcp-tools.mjs"),
          "--timeout-ms",
          "15000",
          "--",
          binary,
          "mcp",
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          timeout: 20_000,
          env: {
            ...process.env,
            OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY: "1",
            OPEN_COMPUTER_USE_VISUAL_CURSOR: "0",
            OPEN_COMPUTER_USE_HOST_ADAPTER: host,
            OPEN_COMPUTER_USE_MODEL_PROFILE: model,
            OPEN_COMPUTER_USE_BINDING: "",
          },
        },
      ),
    );

    const actualTools = probe.tools.map((tool) => tool.name).sort();
    assertEqual(actualTools, expectedTools, `${host}/${model} tool surface`);
    if (probe.instructionsBytes > 2_048) {
      throw new Error(
        `${host}/${model} instructions exceed 2048 UTF-8 bytes: ${probe.instructionsBytes}`,
      );
    }

    const expectedBinding =
      host === "codex" && model === "gpt"
        ? "codex-gpt"
        : host === "claude-code" && model === "deepseek"
          ? "claude-code-deepseek"
          : "none";
    const profile = `Profile: host=${host};model=${model};binding=${expectedBinding}.`;
    if (!probe.instructions.includes(profile)) {
      throw new Error(`${host}/${model} missing expected profile line: ${profile}`);
    }

    results.push({
      host,
      model,
      binding: expectedBinding,
      instructionsLength: probe.instructionsLength,
      instructionsBytes: probe.instructionsBytes,
    });

    if (host === "generic" && model === "generic") {
      const tools = Object.fromEntries(probe.tools.map((tool) => [tool.name, tool]));
      for (const toolName of elementTools) {
        if (tools[toolName]?.propertyTypes?.element_index !== "integer") {
          throw new Error(`${toolName}.element_index must use integer schema`);
        }
      }
      if (tools.get_app_state?.propertyTypes?.disable_screenshot !== "boolean") {
        throw new Error("get_app_state.disable_screenshot must use boolean schema");
      }
      if (tools.get_app_state?.propertyTypes?.disableDiff !== "boolean") {
        throw new Error("get_app_state.disableDiff must use boolean schema");
      }
    }
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "ok",
      binary,
      toolCount: expectedTools.length,
      profiles: results,
    },
    null,
    2,
  )}\n`,
);

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch\nExpected: ${expected.join(", ")}\nActual: ${actual.join(", ")}`,
    );
  }
}
