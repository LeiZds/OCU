# Host × Model Bindings

Read this reference only when an active Binding is named in the Runtime profile line. Bindings contain small, reproduced interaction deltas that cannot live cleanly in either the Host Adapter or Model Profile. They must not duplicate the common decision loop or contain app/site click sequences.

## Selection

Set `OPEN_COMPUTER_USE_BINDING` explicitly, or let the Runtime select a known combination:

- `codex-gpt` for Codex + GPT
- `claude-code-deepseek` for Claude Code + DeepSeek
- `none` for all other combinations

## Codex + GPT

- Inspect a non-empty action-state result directly.
- Do not issue a duplicate `get_app_state` solely to verify that same action.
- Use a compositional wrapper only for one already-chosen action plus immediate verification.

## Claude Code + DeepSeek

- When the user supplies an exact app name or verified identifier, call `get_app_state` on it instead of calling `list_apps`.
- Locate a target by stable ID, role, label, and value, but pass the current row's integer `element_index`; never pass the stable ID string as the argument.
- If the OCU backend is unavailable or a permission is denied, report it once and stop. Do not branch into unrelated tool search or installation unless the user asked for troubleshooting.
- Keep recovery within the DeepSeek failure budget and require current UI evidence before declaring completion.

## Promotion Rule

Add or expand a Binding only after the same combination problem is reproduced in a fresh session and a narrower Host Adapter or Model Profile change would be incorrect. Record the test IDs and counterconditions in the experience log.
