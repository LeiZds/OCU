#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime="${repo_root}/.build/release/OpenComputerUse"

if [[ ! -x "${runtime}" ]]; then
  echo "A/B candidate runtime is missing: ${runtime}" >&2
  exit 1
fi

export OPEN_COMPUTER_USE_HOST_ADAPTER="codex"
export OPEN_COMPUTER_USE_MODEL_PROFILE="gpt"
export OPEN_COMPUTER_USE_RETURN_ACTION_STATE="1"
export OPEN_COMPUTER_USE_DISABLE_APP_AGENT_PROXY="1"

cd "${repo_root}"
exec "${runtime}" mcp
