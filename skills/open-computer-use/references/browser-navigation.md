# Browser Navigation Experience

Read this reference when a task requires navigating a browser to an exact URL. Apply it only when the current state satisfies the stated preconditions; it is not a fixed click sequence.

## Preconditions

- Confirm the intended browser and window from a fresh state.
- If the user named a specific browser, require that exact application identity; another installed browser is not an equivalent target.
- Check for a modal, permission prompt, loading state, or another control that may hold focus.
- Determine the operating system and the actions actually available through the current tool surface.

## Preferred Strategy

When the intended browser is active and its normal address-bar shortcut is supported, `cmd+l` on macOS or `ctrl+l` on Windows and Linux is usually a reliable way to focus and select the address bar. Type the complete requested URL, press Return, and then read state again.

This is a preference, not a universal requirement. Use another semantic mechanism when the current browser exposes a verified address control or the shortcut does not produce the expected focus. Avoid relying on a plain address-bar click or substring `select_text` for full replacement when current evidence shows that existing text may be preserved.

When a fresh state exposes a settable address control, `set_value` is a valid alternative. Before pressing Return, require current focus to be on that same address control; a successful value change does not prove that focus moved with it. If focus remains in a page search field, target the verified address control or use the normal address shortcut, then verify the focus change before submitting.

For an in-page search or other verified settable text field, use the same evidence gate. When the task authorizes full replacement, setting the complete intended value first can avoid a speculative click whose only purpose is to obtain focus. Re-read state and proceed only when the target control exposes both the intended value and focus. If the value changes without focus, or a click succeeds without focus evidence, do not submit or repeat the click mechanically.

## Verification

- Compare the requested origin, path, and query with fresh evidence after navigation.
- Compare URLs after normal URL parsing as well as as displayed strings. For an `https` origin, a browser displaying `https://example.com` while the document reports `https://example.com/` is not a path conflict; report the display-string difference separately. A different path segment, query, origin, or scheme remains material.
- Treat a fresh document URL as strong evidence when the provider is known to update it reliably, but do not assume that any one field is infallible.
- When the address-bar value, document URL, title, screenshot, and page content disagree, mark exact navigation as unresolved. Do not let one conflicting signal silently override the others.
- Allow the page to settle and read state again before diagnosing the cause. Use an independent signal when available.
- Never infer a redirect, proxy, autocomplete behavior, cache issue, or stale accessibility value without evidence that supports that cause.

## Completion Gate

- A successful `press_key`, `type_text`, or `set_value` call proves only that the tool accepted the action.
- Mark an exact navigation stage verified only when reliable current evidence matches the requested normalized origin, path, and query and no reliable current evidence contradicts that match.
- An address bar that displays only a hostname does not prove the current path. If the requested root URL is followed by an observed document URL ending in `/skillpay`, do not mark the root stage complete.
- If root, `/skillpay`, and root attempts all produce the same observed state, report that the stages were not distinguishable from the available evidence. This does not by itself prove that a redirect occurred or that all three navigation objectives succeeded.
- Report each stage as `verified`, `not verified`, or `unresolved`, along with the requested URL and observed signals.

## Recovery

Repeat an identical navigation attempt only when the current evidence gives a specific reason to expect it to help, such as text concatenation or focus landing outside the address bar. Otherwise re-plan from the latest state.

Do not repeat speculative navigation indefinitely. If reliable signals remain in conflict after a bounded check, stop and report the requested URL, the observed signals, and an unresolved status.

## Observation Budget

- Start with the default `get_app_state` budgets. Do not pre-emptively request `text_limit: "max"`, maximum tree depth, or maximum nodes for a task whose address bar and document URL are already visible.
- Keep the same MCP process so later reads can use same-session accessibility diffs. Omit `disableDiff` on routine follow-up checks.
- Use `disable_screenshot: true` for focus, address value, and document URL checks when the semantic tree or diff is sufficient. Retain an image when the tree is ambiguous or the page result itself must be visually inspected. With an older runtime, use host-side content filtering only when the host exposes that capability.
- Expand or refresh the full tree only when the target evidence is missing, the prior baseline is unavailable, or a large UI replacement makes the diff insufficient.
- Do not refocus the address bar solely to expose cosmetic URL formatting when the document URL and page state already provide the requested verification. If the user explicitly asks for the displayed address-bar string, one targeted check is enough.

## Tested Observation: SkillHub

In one macOS Doubao Browser test, the address bar displayed `skillhub.cn` while the accessibility document URL reported `https://skillhub.cn/skillpay`. An independent HTTP request showed that the root URL did not redirect. This establishes an evidence conflict, not a universal explanation and not proof that either UI field is always authoritative.

In a separate Codex-hosted run on 2026-07-22, a fresh new tab exposed a settable address control. Open Computer Use set that control to `https://skillhub.cn/`, detected that focus was still in the page search field, focused the address control, submitted once, and then observed the document URL `https://skillhub.cn/`. This validates the state-conditioned semantic strategy for that app state; it does not make the same element index or action sequence universal.

In a Codex-hosted SkillHub search diagnostic on 2026-07-23, clicking the empty in-page search field did not expose focus through either Codex Computer Use or Open Computer Use. Setting the verified field to `PDF` through Open Computer Use and then re-reading state exposed both `Value: PDF` and focus on that same control; only then was Return submitted successfully. This supports the conditional semantic-input strategy above, but does not establish that every browser or editable provider moves focus after `set_value`.

## Tested Observation: Page Replacement Index Invalidation (T073, T080)

After clicking a link that navigates to a new page (e.g., SkillHub list → detail page), all element indices from the previous page become invalid. OCU correctly returns `unknown_element_index` for stale references. Do not attempt to replay rejected indices.

**Recovery:** Read fresh state after navigation. Re-identify targets by role, label, and value from the new tree. The old index provides no useful signal about the new page.

**Countercondition:** This applies to full page navigations (URL change). In-page UI updates (tab switches, filter changes, modal opens) may preserve some element indices and invalidate others. Treat all indices as provisional after any observable state change.

## Tested Observation: In-Page Search Find Bar (T070)

Doubao Browser's Command+F find bar is a Chromium internal overlay not exposed through the Accessibility API. The AX tree shows no change after pressing Command+F. Do not use browser-native find for page content search. Prefer the web application's own search mechanism.
