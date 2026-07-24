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

## Runtime Action-State Adapter

Set `OPEN_COMPUTER_USE_RETURN_ACTION_STATE=1` when the host cannot compose MCP calls and the extra empty-result model round trip is materially expensive. The existing action tools then return the refreshed state they already collect after settling, normally as a stable-index diff from the state returned before the action. No tool is added, and the model still chooses only one action at a time.

Leave the variable unset or set it to `0` for the compact upstream transport where successful actions return empty content and require a separate `get_app_state`. Errors, `list_apps`, and `get_app_state` retain their normal result in both modes.

The Codex local plugin launcher enables the runtime adapter by default. Explicit caller configuration takes precedence.

## Codex

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

## Other Hosts

Use an equivalent action-and-verification wrapper only when the host explicitly exposes safe tool composition and preserves a single MCP session. Otherwise use direct Open Computer Use calls. Host efficiency features never weaken the common safety, focus, evidence, or confirmation gates.
