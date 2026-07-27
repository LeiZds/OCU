#!/usr/bin/env bash

set -euo pipefail

plugin_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "${plugin_root}/../.." && pwd)"

export OPEN_COMPUTER_USE_HOST_ADAPTER="${OPEN_COMPUTER_USE_HOST_ADAPTER:-generic}"
export OPEN_COMPUTER_USE_MODEL_PROFILE="${OPEN_COMPUTER_USE_MODEL_PROFILE:-generic}"

# Codex already runs as the stable Accessibility-authorized host. Keep local
# plugin rebuilds on that host identity instead of launching a newly ad-hoc
# signed app-agent identity after every iteration. Callers can explicitly set
# this variable to 0 when testing the standalone app-agent permission flow.
if [[ "$(uname -s)" == "Darwin" \
  && "${OPEN_COMPUTER_USE_HOST_ADAPTER}" == "codex" \
  && -z "${OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY:-}" ]]; then
  export OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY=1
fi

candidate_binaries=(
  "${plugin_root}/Open Computer Use.app/Contents/MacOS/OpenComputerUse"
  "${plugin_root}/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse"
  "${plugin_root}/OpenComputerUse.app/Contents/MacOS/OpenComputerUse"
  "${plugin_root}/open-computer-use"
  "${plugin_root}/open-computer-use.exe"
  "${plugin_root}/.build/release/OpenComputerUse"
  "${plugin_root}/dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse"
  "${plugin_root}/dist/Open Computer Use.app/Contents/MacOS/OpenComputerUse"
  "${plugin_root}/dist/OpenComputerUse.app/Contents/MacOS/OpenComputerUse"
  "${repo_root}/dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse"
  "${repo_root}/dist/Open Computer Use.app/Contents/MacOS/OpenComputerUse"
  "${repo_root}/dist/OpenComputerUse.app/Contents/MacOS/OpenComputerUse"
  "${repo_root}/dist/linux/arm64/open-computer-use"
  "${repo_root}/dist/linux/amd64/open-computer-use"
  "${repo_root}/dist/windows/arm64/open-computer-use.exe"
  "${repo_root}/dist/windows/amd64/open-computer-use.exe"
)

for app_binary in "${candidate_binaries[@]}"; do
  if [[ -x "${app_binary}" ]]; then
    if [[ "${app_binary}" == "${plugin_root}"/* ]]; then
      cd "${plugin_root}"
    else
      cd "${repo_root}"
    fi
    exec "${app_binary}" mcp
  fi
done

if command -v open-computer-use >/dev/null 2>&1; then
  exec open-computer-use mcp
fi

echo "open-computer-use could not find a runnable native runtime." >&2
echo "Checked:" >&2
for app_binary in "${candidate_binaries[@]}"; do
  echo "  - ${app_binary}" >&2
done
echo "  - open-computer-use on PATH" >&2
echo "Build the native runtime or install the released OCU package for this host." >&2
exit 1
