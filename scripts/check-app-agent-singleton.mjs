#!/usr/bin/env node

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  process.stdout.write('{"status":"skipped","reason":"macOS only"}\n');
  process.exit(0);
}

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const appBinary = path.join(
  repoRoot,
  "dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse",
);
const genericLauncher = path.join(scriptDir, "launch-open-computer-use.sh");
const launcher = path.join(scriptDir, "launch-open-computer-use-claude.sh");
const probe = path.join(scriptDir, "probe-mcp-tools.mjs");

terminateAgents(findAgents());
await waitForAgentCount(0);

const environment = {
  ...process.env,
  OPEN_COMPUTER_USE_VISUAL_CURSOR: "0",
};
delete environment.OPEN_COMPUTER_USE_HOST_ADAPTER;
delete environment.OPEN_COMPUTER_USE_MODEL_PROFILE;
delete environment.OPEN_COMPUTER_USE_BINDING;

const genericWarmup = await execFileAsync(
  process.execPath,
  [probe, "--timeout-ms", "15000", "--", genericLauncher],
  {
    cwd: repoRoot,
    env: environment,
    timeout: 20_000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const genericResult = JSON.parse(genericWarmup.stdout);
const genericProfile = "Profile: host=generic;model=generic;binding=none.";
if (!genericResult.instructions.includes(genericProfile)) {
  throw new Error(`Warmup probe used the wrong profile: ${genericResult.instructions}`);
}

const probes = await Promise.all(
  Array.from({ length: 4 }, () =>
    execFileAsync(
      process.execPath,
      [probe, "--timeout-ms", "15000", "--", launcher],
      {
        cwd: repoRoot,
        env: environment,
        timeout: 20_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    ),
  ),
);

for (const { stdout } of probes) {
  const result = JSON.parse(stdout);
  if (result.serverInfo?.version !== "1.2.0" || result.toolCount !== 10) {
    throw new Error(
      `Concurrent probe used the wrong runtime: ${result.serverInfo?.version}, ${result.toolCount} tools`,
    );
  }
  const expectedProfile =
    "Profile: host=claude-code;model=deepseek;binding=claude-code-deepseek.";
  if (!result.instructions.includes(expectedProfile)) {
    throw new Error(`Concurrent Claude probe used the wrong profile: ${result.instructions}`);
  }
}

const agents = await waitForAgentCount(1);
const result = {
  status: "ok",
  warmupProfile: "generic/generic",
  concurrentClients: probes.length,
  concurrentProfile: "claude-code/deepseek",
  residentAgentCount: agents.length,
  residentAgentPids: agents.map((agent) => agent.pid),
};

if (!process.argv.includes("--keep-agent")) {
  terminateAgents(agents);
  await waitForAgentCount(0);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function findAgents() {
  const output = execFileSync("/bin/ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
  });
  const marker = `${appBinary} __open-computer-use-app-agent `;
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(marker))
    .map((line) => {
      const separator = line.indexOf(" ");
      return {
        pid: Number(line.slice(0, separator)),
        command: line.slice(separator + 1),
      };
    })
    .filter((entry) => Number.isInteger(entry.pid) && entry.pid > 1);
}

function terminateAgents(agents) {
  for (const agent of agents) {
    try {
      process.kill(agent.pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") {
        throw error;
      }
    }
  }
}

async function waitForAgentCount(expected, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let agents = findAgents();
  while (Date.now() < deadline) {
    agents = findAgents();
    if (agents.length === expected) {
      return agents;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `Expected ${expected} resident app agent(s), observed ${agents.length}: ${JSON.stringify(agents)}`,
  );
}
