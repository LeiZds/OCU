# open-computer-use

[![English](https://img.shields.io/badge/English-Click-yellow)](./README.md)
[![简体中文](https://img.shields.io/badge/简体中文-点击查看-orange)](./README.zh-CN.md)
[![Release](https://img.shields.io/github/v/release/LeiZds/OCU)](https://github.com/LeiZds/OCU/releases)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/LeiZds/OCU)
<a href="https://llmapis.com?source=https%3A%2F%2Fgithub.com%2FLeiZds%2FOCU" target="_blank"><img src="https://llmapis.com/api/badge/LeiZds/OCU" alt="LLMAPIS" width="20" /></a>

> [!TIP]
> Interested in Browser Use? Check out [open-browser-use](https://github.com/iFurySt/open-codex-browser-use).

---

`open-computer-use` is an open-source `Computer Use` service wrapped as `MCP`. Any AI agent or MCP client can use it to run Computer Use on macOS, Linux, and Windows.

This customized distribution is based on
[iFurySt/open-codex-computer-use](https://github.com/iFurySt/open-codex-computer-use)
and retains its MIT license and attribution. V1.1 adds the layered Runtime,
Host Adapter, Model Profile, and Binding architecture used by this repository.
The upstream project was inspired by OpenAI's
[Codex Computer Use](https://openai.com/index/codex-for-almost-everything/).

## Demos

### Codex App and Codex CLI

[![Open Computer Use custom demo cover](./docs/generated/readme-assets/open-computer-use-demo-cover.png)](https://youtu.be/2s6aVpGiwaQ)

<sub><em>`open-computer-use` used as Computer Use in Codex App and Codex CLI, matching the official experience.</em></sub>

### Gemini CLI

https://github.com/user-attachments/assets/eacb3b15-f939-46c7-b3b3-6f876977a58d

<sub><em>Gemini CLI connects to `open-computer-use` through MCP and runs full Computer Use actions.</em></sub>

### Linux

https://github.com/user-attachments/assets/e036b1c8-2200-4896-abd4-19225915cf66

<sub><em>`open-computer-use` running on Linux.</em></sub>

## Quick Start

```bash
npm i -g open-computer-use
```

The npm package also exposes `ocu` as the short CLI alias.

> [!IMPORTANT]
> The macOS runtime requires macOS 14.0 or later.

**On macOS, run it once and grant `Accessibility` and `Screen Recording`. Windows and Linux do not need this step.**

```bash
open-computer-use
# or
ocu
```

Before using it, install it into your agent:

```bash
# Install into Codex by writing to ~/.codex/config.toml
open-computer-use install-codex-mcp
```

Or add it to your own client manually:

```json
{
  "mcpServers": {
    "open-computer-use": {
      "command": "open-computer-use",
      "args": ["mcp"]
    }
  }
}
```

### Skill

Install the skill directly:

```bash
# Install for Codex
npx skills add LeiZds/OCU -g -a codex --skill open-computer-use -y
npx skills ls -g -a codex | rg 'open-computer-use'
```

Install for Claude Code:

```bash
npx skills add LeiZds/OCU -g -a claude-code --skill open-computer-use -y
```

Install the complete V1.1 Claude Code plugin directly from this GitHub repository
(Skill, MCP server, Host Adapter hooks, and model profile):

```bash
claude plugin marketplace add https://github.com/LeiZds/OCU
claude plugin install open-computer-use@ocu
```

Update an existing global install, including the Codex install created above:

```bash
npx skills update open-computer-use -g -y
```

You can also manually download and install the
[`open-computer-use` skill](./skills/open-computer-use).

## More

Besides the MCP JSON config above, you can also use the built-in commands:

```bash
# Install into Codex by writing to ~/.codex/config.toml
open-computer-use install-codex-mcp
ocu install-codex-mcp

# Install as a Codex plugin, mainly for Codex App
open-computer-use install-codex-plugin

# Install into Claude Code by writing to ~/.claude.json
open-computer-use install-claude-mcp

# Install into Gemini CLI for the current project by writing to ./.gemini/settings.json
open-computer-use install-gemini-mcp

# Install into Gemini CLI user config instead
open-computer-use install-gemini-mcp --scope user

# Install into opencode by writing to ~/.config/opencode/opencode.json (or the active config file)
open-computer-use install-opencode-mcp

# Call a single Computer Use tool and print the MCP-style JSON result
open-computer-use call list_apps
ocu call list_apps
open-computer-use call get_app_state --args '{"app":"TextEdit"}'

# Run a sequence in one process so element_index state can be reused
# Sequence runs sleep 1s between successful operations by default
open-computer-use call --calls '[{"tool":"get_app_state","args":{"app":"TextEdit"}},{"tool":"press_key","args":{"app":"TextEdit","key":"Return"}}]'
open-computer-use call --calls-file examples/textedit-overlay-seq.json --sleep 0.5

# Check permissions; onboarding only opens when something is missing
open-computer-use doctor

# Run local validation from a source checkout
make smoke
OPEN_COMPUTER_USE_STRESS_LOOPS=20 make stress
make agent-smoke
make agent-smoke SCENARIO=fixture-full
node ./scripts/run-agent-smoke-tests.mjs --agents=claude,codex --command=open-computer-use
node ./scripts/run-agent-smoke-tests.mjs --scenario=fixture --agents=claude,codex --command=open-computer-use
node ./scripts/run-agent-smoke-tests.mjs --scenario=fixture-full --agents=claude,codex --command=open-computer-use
OPEN_COMPUTER_USE_HERMES_PROVIDER=anthropic OPEN_COMPUTER_USE_HERMES_MODEL=claude-opus-4-20250514 make agent-smoke AGENTS=hermes SCENARIO=fixture-full
node ./scripts/run-agent-smoke-tests.mjs --agents=hermes --hermes-provider=anthropic --hermes-model=claude-opus-4-20250514
node ./scripts/run-agent-smoke-tests.mjs --scenario=fixture --agents=hermes --hermes-provider=anthropic --hermes-model=claude-opus-4-20250514
node ./scripts/run-agent-smoke-tests.mjs --scenario=fixture-full --agents=hermes --hermes-provider=anthropic --hermes-model=claude-opus-4-20250514 --hermes-max-turns=12

# Run the isolated Claude Code Harness + model + V1.1 plugin regression.
# Do not add --bare: Claude Code 2.1.218 omits plugin MCP tools in print mode under --bare.
make claude-harness SCENARIO=list-apps CLAUDE_COMMAND=/path/to/claude CLAUDE_MODEL=deepseek-v4-flash
make claude-harness SCENARIO=fixture-basic CLAUDE_COMMAND=/path/to/claude CLAUDE_MODEL=deepseek-v4-flash

# Show help
open-computer-use -h
ocu -h
```

## Cursor Motion

Cursor Motion is an open-source cursor motion system for macOS, based on public information shared by members of the Software.Inc team. You can download the app from the [Releases page](https://github.com/iFurySt/open-codex-computer-use/releases).

[![Cursor Motion custom demo cover](./docs/generated/readme-assets/cursor-motion-demo-cover.png)](https://youtu.be/KRUq5GUHv1Q)

## Star History

<a href="https://www.star-history.com/?repos=LeiZds%2FOCU&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ifuryst/open-codex-computer-use&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ifuryst/open-codex-computer-use&type=date&legend=top-left" />
    <img alt="Star History Chart for open-computer-use" src="https://api.star-history.com/chart?repos=ifuryst/open-codex-computer-use&type=date&legend=top-left" />
  </picture>
</a>

## License

[MIT](./LICENSE)
