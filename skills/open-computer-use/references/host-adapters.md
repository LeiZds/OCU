# Host Adapter Experience

Read only the section for the current agent host. A host adapter maps the common Open Computer Use decision loop onto host execution primitives; it must not contain website-specific action sequences or replace current-state planning.

## Common Contract

- The model reads current state and chooses exactly one state-changing action.
- The runtime may return its already-refreshed, screenshot-free state as the successful action result. When it does, inspect that result and do not request a duplicate state solely to verify the same action.
- The host may execute that one action and its immediate `get_app_state` verification together.
- Use a host wrapper only when the user's explicit tool whitelist and host policy permit it. A wrapper must not be used to bypass a direct-tool-only request.
- The verification result must be returned to the model before it chooses another action.
- Do not batch two clicks, a click plus typing, or any other pair of state-changing actions inside one wrapper call.
- If the action reports an error, do not hide it behind a later state read.
- Keep the same Open Computer Use MCP process so element mapping and diff baselines remain valid.

The Runtime selects a host adapter with `OPEN_COMPUTER_USE_HOST_ADAPTER`. Supported values are `generic`, `codex`, `claude-code`, and `workbuddy`. Host adapters may optimize tool exposure, permissions, lifecycle, and verification transport; they never override the common safety, app-identity, fresh-index, or completion-evidence contract.

## Runtime Action-State Adapter

Set `OPEN_COMPUTER_USE_RETURN_ACTION_STATE=1` when the host cannot compose MCP calls and the extra empty-result model round trip is materially expensive. The existing action tools then return the refreshed state they already collect after settling, normally as a same-session accessibility diff from the state last presented to the model. No tool is added, and the model still chooses only one action at a time.

Leave the variable unset or set it to `0` for the compact upstream transport where successful actions return empty content and require a separate `get_app_state`. Errors, `list_apps`, and `get_app_state` retain their normal result in both modes.

The Codex local plugin launcher enables the runtime adapter by default. Explicit caller configuration takes precedence.

## Codex

Use `OPEN_COMPUTER_USE_HOST_ADAPTER=codex`. The Codex launcher pairs it with the `gpt` model profile by default while allowing an explicit override.

When Codex exposes a compositional `exec` tool whose nested tools include names such as `mcp__open_computer_use__click` and `mcp__open_computer_use__get_app_state`, prefer that wrapper for an action-and-verification pair only when transparent host orchestration is permitted. This removes the otherwise empty action-result model round trip while preserving the one-action decision boundary.

Conceptual pattern:

```javascript
const action = await tools.mcp__open_computer_use__click({
  app: targetApp,
  element_index: chosenIndex
});
if (action.isError) {
  text(action);
  exit();
}
const state = await tools.mcp__open_computer_use__get_app_state({
  app: targetApp,
  disable_screenshot: true
});
text(state);
```

Choose the action arguments before entering the wrapper. Use the returned state in the next model decision. Do not discover an element and act on it through hard-coded parsing inside the wrapper, and do not add a second state-changing call.

If nested Open Computer Use tools are unavailable, use the direct MCP calls and perform the same immediate verification in the next call.

## Claude Code

Use `OPEN_COMPUTER_USE_HOST_ADAPTER=claude-code`. The Claude Code launcher uses `deepseek` and the `claude-code-deepseek` Binding by default for the current target stack.

- Use the namespaced Open Computer Use MCP tools already exposed by the plugin. Do not start Shell or search unrelated tools when the backend is available.
- Keep one MCP process for current `element_index` mappings and Diff state.
- Treat MCP permission approval as permission only, not proof that the requested action ran or completed.
- If the backend is absent or permission is denied, report that state once. Do not create a parallel installation or diagnostic chain unless the user requested troubleshooting.
- Prefer direct calls because Claude Code does not promise Codex-style nested tool composition. Inspect the action-returned state before issuing a separate verification read.

The Claude Code adapter must keep server instructions at or below 2048 characters because observed Harness versions may truncate longer MCP instructions. Detailed app and scenario experience belongs in Skill references.

## WorkBuddy

Use `OPEN_COMPUTER_USE_HOST_ADAPTER=workbuddy`. Preserve app identity and current state explicitly. Do not assume Codex wrappers, Claude Code Skill discovery, or another host's permission behavior. Add a WorkBuddy-specific Binding only after a combination failure is reproduced and cannot be explained by the Host Adapter or Model Profile alone.

## Other Hosts

Use an equivalent action-and-verification wrapper only when the host explicitly exposes safe tool composition and preserves a single MCP session. Otherwise use direct Open Computer Use calls. Host efficiency features never weaken the common safety, focus, evidence, or confirmation gates.
