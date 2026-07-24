# Dynamic Content Experience

Read this reference when a task must traverse an incrementally loaded or virtualized list, or when a reload/navigation may have replaced the current accessibility tree. These are conditional decision rules, not a replay sequence.

## Preconditions

- Start from a fresh state in the intended app and window.
- Identify the requested record boundary, semantic deduplication key, and safe stopping condition before scrolling.
- Keep state reads in the same MCP process when possible so stable-index diffs can be evaluated.

## Incremental and Virtualized Lists

After each bounded scroll, inspect the returned action state or one explicit follow-up state:

- If new records are already present, process them immediately; do not add an unconditional wait or duplicate state read merely because a loading label was transient.
- Classify the list as append-only only when earlier records and their identities remain present while new records are added.
- Treat it as potentially virtualized when earlier nodes disappear, are recycled, or change identity as the viewport moves. In that case, deduplicate records by a task-relevant semantic key such as a canonical URL or stable record ID, not by element index.
- Record the first and last item of each batch, total unique records, duplicates, and the evidence that the requested boundary was reached. A successful scroll call alone is not completion evidence.
- If a web listbox accepts a targeted scroll but produces no semantic or visual movement, do not repeat it blindly. A bounded keyboard-page fallback is only safe after verifying that the target is a web-descendant list, the direction is vertical, the page count is integral, and focus is not in an editor.
- Keyboard navigation can move an active descendant, which some AX providers render with a selected-looking state even when the web component did not invoke its business selection handler. Treat that as an observable semantic difference: compare focus/selection before and after, return focus to a neutral web container when safe, and do not infer a business selection change without independent evidence.
- Stop when the requested count or boundary is verified, the end marker is observed, or a bounded scroll produces no new semantic records. Do not scroll indefinitely.

## Page Replacement and Stale Indexes

A reload, navigation, or large asynchronous replacement can invalidate the complete element map even if the visible layout looks unchanged.

1. Treat every pre-replacement index as provisional.
2. If an old index is rejected as unknown or stale, do not retry it.
3. Read state once, find the intended target by role, label, value, and window ownership, then use the new index once.
4. Verify the resulting URL, value, selected state, or content.

If an old index is accepted, verify that it still represents the same semantic target. Acceptance is not proof that an index retained its meaning.

## Recovery Boundary

- Use at most one fresh-state remap for the same stale-index failure unless current evidence establishes a different failure.
- Stop unresolved if the refreshed state does not expose the intended target or if reliable signals conflict.
- Never convert a stale-index recovery into repeated blind clicks.

## Locally Validated Evidence

- **Status:** locally validated; not yet cross-context validated.
- **Scope:** Codex host on macOS, Doubao Browser, SkillHub, vlist.io, official Computer Use `1.0.1000451`, and the current Open Computer Use `0.2.0` development runtime.
- **Incremental list result:** both implementations observed 24 initial skill records followed by 24 appended records, for 48 unique canonical URLs and zero duplicates. The current Open Computer Use binary repeated this in three fresh processes; earlier record indices remained stable, so this specific page behaved as append-only rather than virtualized.
- **Controlled virtual-list result:** a native macOS fixture reused four stable button objects for twelve records. Both implementations observed the same indices change from `VT-001...VT-004` to `VT-005...VT-008` and then `VT-009...VT-012`; clicking the freshly verified first slot in the second batch selected `VT-005`. Open Computer Use completed the semantic-ID collection, selection, and two-page restore in three independent Codex Agent processes.
- **Third-party virtual-list result:** vlist.io exposes 100,000 records through a WAI-ARIA listbox and recycles visible DOM rows. Official Computer Use moved the viewport with one listbox scroll and exposed about nine new semantic order IDs in the controlled sample. Open Computer Use's pid-targeted wheel was accepted but produced no tree movement; adding a pid-targeted mouse-move prime still produced no new records and was reverted. A focused two-`Page_Down` fallback exposed ten new IDs and restored the first batch in three independent runtime processes. The final candidate returns focus to the web area after each page operation; vlist's source confirms PageDown calls its focus `move()` path rather than its business `select()` path, although Chromium AX still renders the active descendant with a selected-looking state. The explicit global-HID diagnostic exposed about seven new IDs but foregrounded the browser and left focus drift. Core traversal is 3/3, but AX-active-item and pixel parity remain open.
- **Replacement result:** after browser reload, both implementations rejected the pre-reload Home index. Open Computer Use returned `unknown element_index`, accepted one fresh-state remap, and restored the verified root URL without a misclick or loop.
- **Counterconditions:** the controlled fixture and third-party core traversal are 3/3, but the web sample still has AX active-item and displacement differences. Its run paused when browser CPU exceeded the local pressure budget and resumed only after the gate returned ready. Large native tables, editors, other browsers, and other operating systems remain unverified.

## State Budget Recommendations

These are conditional decision rules for choosing `get_app_state` budgets based on task needs. Use them to reduce token consumption without losing decision-critical evidence.

### Budget Tiers

| Tier | max_tree_nodes | text_limit | disable_screenshot | What It Reveals |
|------|---------------|-----------|-------------------|-----------------|
| **Minimal** | 30-40 | 80-100 | true | Browser chrome: address bar, tabs, toolbar buttons, bookmarks |
| **Compact** | 60-80 | 50-60 | true | Minimal + page title, metadata, navigation buttons, URLs |
| **Full** | default | default | conditional | Complete accessibility tree including all page content |

### When to Use Each Tier

**Minimal (30-40 nodes):**
- Verifying which app/window is active
- Reading the address bar URL
- Checking tab state (which tab is selected)
- Simple navigation preparation (identifying the address bar element)

**Compact (60-80 nodes):**
- Page identity verification (title, URL, category)
- Reading metadata (ratings, tags, authors)
- Finding navigation buttons (menu, back, search)
- Simple page exploration

**Full (default):**
- Detailed page content interaction
- Form filling with complex fields
- Reading long text content
- First observation of an unknown page

### Decision Flow

1. Start with **Minimal** budget if the task only requires URL/identity checks.
2. If needed controls are not visible, expand to **Compact**.
3. If the task requires interacting with page content, use **Full** budget on first observation.
4. On subsequent state reads in the same MCP process, use diff mode (omit `disableDiff`) to get only changes.
5. After a successful action that returns non-empty state, inspect that result directly; do not issue a duplicate `get_app_state`.

### Evidence

- **Scope:** Codex host on macOS, Doubao Browser, SkillHub, Open Computer Use `0.2.0`.
- **Minimal (40 nodes):** Confirmed to show address bar (`skillhub.cn`), tab identifiers (`SkillHub-专为中国用户优化的Skills社区`), external tab (`腾讯隐私保护平台`), navigation buttons, and bookmark bar. Page content area was cut off at node 48.
- **Compact (80 nodes):** Confirmed to additionally show page title (`english-learning-coach-txqy`), rating (`4.5 优秀`), security indicator (`安全`), category tags, and navigation buttons.
- **Full:** ~1200 nodes on the English Learning Coach detail page, including all skill instruction text.

### Counterconditions

- Do not use Minimal or Compact budgets when the task requires finding a specific control that is likely in the page content area. Start with Full.
- If the Compact budget reveals that the needed control is missing, expand to Full rather than guessing.
- Do not apply these tiers to non-browser applications without separate calibration.
