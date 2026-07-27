#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export OPEN_COMPUTER_USE_HOST_ADAPTER="${OPEN_COMPUTER_USE_HOST_ADAPTER:-claude-code}"
export OPEN_COMPUTER_USE_MODEL_PROFILE="${OPEN_COMPUTER_USE_MODEL_PROFILE:-deepseek}"
export OPEN_COMPUTER_USE_RETURN_ACTION_STATE="${OPEN_COMPUTER_USE_RETURN_ACTION_STATE:-1}"

exec "${script_dir}/launch-open-computer-use.sh"
