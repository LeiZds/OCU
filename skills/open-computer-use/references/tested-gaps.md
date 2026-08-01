# Known Gaps and Workarounds

Results from 78 controlled tests (T001-T080) on Codex + Open Computer Use 0.2.0, macOS, Doubao Browser.

Apply these only when preconditions match. This is conditional guidance, not a fixed sequence.

## P0: PID-Posted Coordinate Clicks Are Not Verifiable

**Finding (V1.2 controlled fixture):** `CGEvent.postToPid` mouse coordinates did not reliably reach the requested target window and could be interpreted by another visible window. Adding window-number fields did not provide a trustworthy delivery guarantee.

**Impact:** Treating a successful event post as a successful click can create a wrong-window mutation.

**Workaround:**
- Use accessibility actions whenever the current tree exposes a semantic target.
- `click_method=app_post` coordinate input is rejected instead of being reported as successful.
- Coordinate click requires a current screenshot and unchanged window fingerprint.
- The only supported coordinate fallback is explicit `click_method=global` with `OPEN_COMPUTER_USE_ALLOW_GLOBAL_POINTER_FALLBACKS=1`; it revalidates the app/window before clicking and restores the previous pointer position afterward.
- Re-read semantic state or check an independent oracle after the click. Never store the coordinate as reusable experience.

**Scope:** macOS coordinate clicks. Scroll and drag still have separate best-effort delivery paths and are not promoted to the same guarantee.

## P0b: Screenshot Format Token Overhead

**Finding (T062):** OCU returns screenshots as base64-encoded PNG inline in the tool result. A 1113x733 screenshot consumes approximately 100,000-270,000 tokens. This is 8,500x-22,700x more than Codex CU's JPEG file-path approach (~12 tokens).

**Impact:** A session with 10 screenshots can consume 1-2.7 million tokens on screenshots alone.

**Workaround:**
- Always prefer disable_screenshot: true when AX tree evidence is sufficient.
- Mark a task as semantic-only when roles, values, selected states, text, focus, or document URLs provide complete evidence.
- Keep one screenshot for initial window verification when app identity is ambiguous.
- After a scroll or content change whose result cannot be verified semantically, request one bounded screenshot; do not request a screenshot merely to reassure.

**Scope:** This gap is at the MCP protocol/Runtime level, not fixable through Skills alone.

## P1: Excessive settable Markers

**Finding (T062):** OCU marks nearly all container, toolbar, tab, and button elements as settable. Codex CU restricts settable markers to actual value-assignable controls (text fields, combos).

**Impact:** Agent may attempt set_value on non-input controls, causing rejected calls or incorrect state interpretation.

**Workaround:**
- Before set_value, verify the element role is a known editable type (text field, text area, combo box).
- A settable marker on a button, container, label, toolbar, or separator is noise; do not treat these as value-assignable.
- If set_value returns rejection, it is expected protocol behavior; re-identify the correct editable target from current state.
- Prefer type_text for incremental input when the element role is ambiguous but semantic context suggests editability.

**Scope:** Runtime/AX parser level. The workaround is effective but increases decision-layer overhead.

## P2: URL Format Inconsistency

**Finding (T062):** OCU retains https:// prefix in document URLs. Codex CU strips it. Address bar values in Doubao Browser may show only the hostname while the document URL field shows the full path.

**Workaround:**
- When comparing URLs, normalize before comparison: strip https:// prefix, trim trailing slashes, and decode percent-encoded characters.
- Use the HTML content element's URL field as the authoritative source for the current document location.
- The address bar text field shows the displayed URL, which may differ from the document URL in cosmetic ways. Both are useful but not interchangeable.

## P2b: Text Fragmentation (T079 NEW)

**Finding (T079):** OCU splits semantically related text into multiple independent elements. For example, a SkillHub card showing "4.6 Excellent (AI Score)" as one unit in Codex CU appears as 3+ separate text elements in OCU.

**Impact:** Higher token consumption for page understanding. Agent must reassemble fragmented text to interpret content, increasing reasoning overhead and risk of misassembly.

**Workaround:**
- When scanning for structured data (ratings, metadata, list items), expect text to be fragmented across adjacent elements.
- Use sibling/child relationships in the AX tree to reconstruct semantic units.
- Prefer type_text or set_value on the nearest editable ancestor when a text field's label and value appear as separate elements.

**Scope:** Runtime/AX parser level. Codex CU appears to perform text aggregation at the AX parsing stage.

## P2c: Virtual List Full Output (T079 NEW)

**Finding (T079):** Codex CU uses segmented rendering for large lists (showing 0-100 of 110 items) while OCU outputs all visible elements at once (~1125 items for a typical page).

**Impact:** In long-list scenarios (search results, product listings, skill directories), OCU's state payload is significantly larger, consuming more tokens and making it harder for the Agent to find relevant items.

**Workaround:**
- When searching large pages, use max_tree_nodes to limit output.
- Prefer targeted searches within the AX tree over full-page scans.
- Use max_tree_depth to prune irrelevant nesting levels.

**Scope:** Runtime level. A segmented rendering strategy would require changes to the AX tree traversal logic.

## P3: Browser Find Bar Not Exposed

**Finding (T070):** Doubao Browser's Command+F find bar (Chromium internal overlay) is not exposed through the Accessibility API. The AX tree shows no change after pressing Command+F.

**Workaround:**
- Do not rely on browser-native find for page content search.
- Use the web application's own search mechanism when available.
- Use get_app_state with increased max_tree_nodes to scan page content for target text.

## P4: macOS Menu Bar Inconsistency

**Finding (T062, T079):** OCU sometimes includes macOS menu bar items in the accessibility tree, and sometimes excludes them. This causes element index instability between calls. Codex CU consistently excludes menu bar items.

**Workaround:**
- After any state refresh, verify target element identity by role, label, and value rather than relying on a previously observed index.
- The menu bar typically occupies elements with roles matching application menu names. Skip these when searching for page content.
- If menu bar elements appear, subtract their count from element indices to estimate the application-content boundary.

## P5: Virtual List Scroll Verification

**Finding (T057, T078):** SkillHub and similar virtual-list pages may show no change in the AX tree after small scrolls because visible elements haven't changed enough to register. This is a property of virtual DOM rendering, not an OCU defect.

**Workaround:**
- After a small scroll, the absence of AX tree changes does not prove the scroll failed. Look for indirect evidence: back-to-top button appearance, changed element counts, or different link texts.
- For virtual lists, prefer larger scroll steps when collecting items.
- Request one screenshot when semantic evidence cannot prove movement.

## Scope and Promotion Status

All findings above are at locally validated status on macOS + Doubao Browser + Codex host. They have not been cross-validated on other platforms, browsers, or agent hosts. Do not promote to cross-context experience until verified in at least one additional environment.

Total known gaps: 9 (P0: 2, P1: 1, P2: 3, P3: 1, P4: 1, P5: 1). Last updated: 2026-08-01 V1.2 controlled fixture.
