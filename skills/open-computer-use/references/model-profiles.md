# Model Profiles

Read only the section matching the active model family. A Model Profile adjusts observable tool-use guidance; it does not fine-tune weights, request hidden chain-of-thought, or own host permissions and lifecycle.

The Runtime selects a profile with `OPEN_COMPUTER_USE_MODEL_PROFILE`. Supported values are `generic`, `gpt`, and `deepseek`.

## Common Contract

- Express planning through the selected target, next tool call, expected evidence, and final result.
- Preserve one state-changing action per decision step.
- Prefer the shortest semantic path supported by current evidence.
- Apply the same safety, authorization, fresh-index, and completion gates for every model.

## GPT

- Use `state → one action → evidence`.
- Do not repeat app discovery after the exact app identity is known.
- Inspect non-empty action state directly before requesting another state read.

## DeepSeek

- Keep visible planning to target, next action, and expected evidence; do not narrate long exploratory chains.
- On an unchanged result, identify the failed assumption before retrying.
- After two unchanged failures, change strategy once or stop unresolved. Do not repeat speculative clicks, state reads, permission checks, or app discovery.
- Treat a successful MCP response as action acceptance only. Require task-specific UI evidence before completion.
- Preserve exact Unicode code points and normalization when the requested value distinguishes visually equivalent sequences.
- When a task or harness requires an exact final token, output only that token without a prefatory summary.

## Other Models

Start with `generic`. Create a new Model Profile only after repeated evidence shows a model-family behavior across more than one Host Adapter. Keep a host-specific issue in the Host Adapter and a single host-model interaction in a Binding.
