#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
binary_path="${repo_root}/dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse"
expected_sha256="d1b8355daa6dea619e904b2057f17595d61c8b85590deb84a7100325210fbd4e"

if [[ ! -x "${binary_path}" ]]; then
  echo "OCU V1.0 baseline binary is missing or not executable: ${binary_path}" >&2
  exit 1
fi

actual_sha256="$(shasum -a 256 "${binary_path}" | awk '{print $1}')"
if [[ "${actual_sha256}" != "${expected_sha256}" ]]; then
  echo "OCU V1.0 baseline binary hash mismatch." >&2
  echo "Expected: ${expected_sha256}" >&2
  echo "Actual:   ${actual_sha256}" >&2
  exit 1
fi

export OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY="${OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY:-1}"
export OPEN_COMPUTER_USE_RETURN_ACTION_STATE="${OPEN_COMPUTER_USE_RETURN_ACTION_STATE:-1}"
export OPEN_COMPUTER_USE_VISUAL_CURSOR="${OPEN_COMPUTER_USE_VISUAL_CURSOR:-0}"

if [[ "${1:-}" == "--probe" ]]; then
  exec node "${repo_root}/scripts/probe-mcp-tools.mjs" -- "${binary_path}" mcp
fi

exec "${binary_path}" mcp
