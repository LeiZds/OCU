#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_commit="54004e007dfb081754b3c03c93fb54696d3d35d4"
source_path="dist/Open Computer Use (Dev).app/Contents/MacOS/OpenComputerUse"
binary_path="${repo_root}/.build/baselines/ocu-v1.0/OpenComputerUse"
expected_sha256="d1b8355daa6dea619e904b2057f17595d61c8b85590deb84a7100325210fbd4e"

actual_sha256=""
if [[ -f "${binary_path}" ]]; then
  actual_sha256="$(shasum -a 256 "${binary_path}" | awk '{print $1}')"
fi

if [[ "${actual_sha256}" != "${expected_sha256}" ]]; then
  mkdir -p "$(dirname "${binary_path}")"
  temporary_binary="${binary_path}.tmp.$$"
  git -C "${repo_root}" show "${source_commit}:${source_path}" > "${temporary_binary}"
  extracted_sha256="$(shasum -a 256 "${temporary_binary}" | awk '{print $1}')"
  if [[ "${extracted_sha256}" != "${expected_sha256}" ]]; then
    rm -f "${temporary_binary}"
    echo "OCU V1.0 baseline binary hash mismatch after extraction." >&2
    echo "Expected: ${expected_sha256}" >&2
    echo "Actual:   ${extracted_sha256}" >&2
    exit 1
  fi
  chmod +x "${temporary_binary}"
  mv "${temporary_binary}" "${binary_path}"
fi

export OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY="${OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY:-1}"
export OPEN_COMPUTER_USE_RETURN_ACTION_STATE="${OPEN_COMPUTER_USE_RETURN_ACTION_STATE:-1}"
export OPEN_COMPUTER_USE_VISUAL_CURSOR="${OPEN_COMPUTER_USE_VISUAL_CURSOR:-0}"

if [[ "${1:-}" == "--probe" ]]; then
  exec node "${repo_root}/scripts/probe-mcp-tools.mjs" -- "${binary_path}" mcp
fi

exec "${binary_path}" mcp
