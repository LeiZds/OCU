#!/usr/bin/env node

import { spawn } from "node:child_process";

const separatorIndex = process.argv.indexOf("--");
if (separatorIndex === -1 || separatorIndex === process.argv.length - 1) {
  process.stderr.write(
    "Usage: node scripts/probe-mcp-tools.mjs [--timeout-ms N] -- <command> [args...]\n",
  );
  process.exit(2);
}

let timeoutMs = 10_000;
const timeoutIndex = process.argv.indexOf("--timeout-ms");
if (timeoutIndex !== -1) {
  const parsed = Number(process.argv[timeoutIndex + 1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    process.stderr.write("--timeout-ms must be a positive number\n");
    process.exit(2);
  }
  timeoutMs = parsed;
}

const command = process.argv[separatorIndex + 1];
const args = process.argv.slice(separatorIndex + 2);
const child = spawn(command, args, {
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});

let stdoutBuffer = "";
let stderrBuffer = "";
let initializeResult;
let finished = false;

const timer = setTimeout(() => {
  finishWithError(`MCP probe timed out after ${timeoutMs}ms`);
}, timeoutMs);

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderrBuffer += chunk;
});

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  consumeLines();
});

child.on("error", (error) => {
  finishWithError(`Failed to start MCP server: ${error.message}`);
});

child.on("exit", (code, signal) => {
  if (!finished) {
    finishWithError(
      `MCP server exited before tools/list completed (code=${code}, signal=${signal})`,
    );
  }
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "ocu-baseline-probe", version: "1.0.0" },
  },
});

function consumeLines() {
  while (true) {
    const newlineIndex = stdoutBuffer.indexOf("\n");
    if (newlineIndex === -1) {
      return;
    }

    const line = stdoutBuffer.slice(0, newlineIndex).trim();
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    if (!line) {
      continue;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }

    if (message.id === 1) {
      initializeResult = message.result;
      send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      continue;
    }

    if (message.id === 2) {
      const tools = message.result?.tools ?? [];
      finishSuccessfully({
        serverInfo: initializeResult?.serverInfo ?? null,
        protocolVersion: initializeResult?.protocolVersion ?? null,
        instructionsLength:
          typeof initializeResult?.instructions === "string"
            ? initializeResult.instructions.length
            : 0,
        toolCount: tools.length,
        tools: tools.map((tool) => ({
          name: tool.name,
          descriptionLength:
            typeof tool.description === "string" ? tool.description.length : 0,
          required: tool.inputSchema?.required ?? [],
          properties: Object.keys(tool.inputSchema?.properties ?? {}),
        })),
      });
    }
  }
}

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function finishSuccessfully(result) {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timer);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  child.stdin.end();
  child.kill("SIGTERM");
}

function finishWithError(message) {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timer);
  child.kill("SIGTERM");
  process.stderr.write(`${message}\n`);
  if (stderrBuffer.trim()) {
    process.stderr.write(`MCP stderr:\n${stderrBuffer.trim()}\n`);
  }
  process.exitCode = 1;
}
