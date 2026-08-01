#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/ocu-codex-plugin-install.XXXXXX")"

marketplace_source="$(node -e '
const fs = require("node:fs");
const path = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
process.stdout.write(manifest.plugins?.[0]?.source?.path ?? "");
' "${repo_root}/.agents/plugins/marketplace.json")"

if [[ "${marketplace_source}" != "./" && "${marketplace_source}" != "." ]]; then
  echo "Codex marketplace install check failed: the plugin source must be the repository root so Git installs include the Runtime and Skill." >&2
  exit 1
fi

marketplace_required_paths=(
  "${repo_root}/.codex-plugin/plugin.json"
  "${repo_root}/scripts/launch-open-computer-use-codex.sh"
  "${repo_root}/skills/open-computer-use/SKILL.md"
  "${repo_root}/dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse"
)

for required_path in "${marketplace_required_paths[@]}"; do
  if [[ ! -f "${required_path}" ]]; then
    echo "Codex marketplace install check failed: missing ${required_path}" >&2
    exit 1
  fi
done

cleanup() {
  rm -rf "${test_root}"
}
trap cleanup EXIT

codex_home="${test_root}/codex-home"
CODEX_HOME="${codex_home}" "${repo_root}/scripts/install-codex-plugin.sh" --configuration debug >/dev/null

plugin_version="$(node "${repo_root}/scripts/install-config-helper.mjs" codex-plugin-version "${repo_root}/plugins/open-computer-use/.codex-plugin/plugin.json")"
plugin_root="${codex_home}/plugins/cache/open-computer-use-local/open-computer-use/${plugin_version}"

required_paths=(
  "${plugin_root}/.codex-plugin/plugin.json"
  "${plugin_root}/.mcp.json"
  "${plugin_root}/scripts/launch-open-computer-use.sh"
)

for required_path in "${required_paths[@]}"; do
  if [[ ! -f "${required_path}" ]]; then
    echo "Codex plugin layout check failed: missing ${required_path}" >&2
    exit 1
  fi
done

if [[ -d "${plugin_root}/open-computer-use" ]]; then
  echo "Codex plugin layout check failed: plugin contents were copied into a nested open-computer-use directory." >&2
  exit 1
fi

if ! rg -q '^\[plugins\."open-computer-use@open-computer-use-local"\]$' "${codex_home}/config.toml"; then
  echo "Codex plugin layout check failed: enabled plugin entry is missing from config.toml." >&2
  exit 1
fi

echo "Codex plugin install layout check passed (${plugin_version})."
