# Application-Specific Experience

Read only the section for the application currently in scope. Treat these as scoped observations whose preconditions must match the current UI.

## Doubao and Doubao Browser

On macOS, `豆包` (`com.bot.pc.doubao`) and `豆包浏览器` (`com.bot.pc.doubao.browser`) are different applications. When the user names 豆包浏览器, target the exact display name or the verified browser bundle identifier. Do not substitute 豆包 or Google Chrome. After `get_app_state`, require the returned app identity to match before typing, clicking, or navigating.

When macOS 豆包浏览器 returns only a system-dialog tree and a 52×52 avatar screenshot, one Codex + Open Computer Use dev run recovered the normal browser window by pressing `super+t` once and then reading state again. Apply this only when the same abnormal evidence is present. Do not press `super+t` on every launch, do not repeat it speculatively, and accept recovery only when the next state proves a standard browser window with its tab bar and address field.

## Slack

Focus and re-check the intended composer before pressing Return. Use the screenshot as an additional signal when Slack accessibility text is inconsistent.

## Spotify and Music

Request state again before repeating a playback or search action because network-backed state can lag.

## Numbers

Observed behavior supports one click to edit or append and a triple click to replace. Enter no more than one tab-delimited row per `type_text` call unless current testing proves a broader safe pattern.

## Notion

Account for block selection, placeholders, and context-dependent Return behavior. Re-read state rather than assuming the same key has the same effect in every block state.

## Clock

For timer fields, focus each slider and type validated hour, minute, and second values.

## iPhone Mirroring

Prefer `scroll` for navigation and click icon centers rather than labels when the current accessibility state exposes labels separately from the actionable icon.

## Doubao Browser: Search and Form Behavior (T063-T065, T067-T068 validated)

**Search auto-trigger:** SkillHub's search field triggers a real-time search on value change. When `set_value` or `type_text` changes the search field value, the web application may automatically update the URL (adding `keyword=...` parameter) and filter results. This is application behavior, not an OCU action. Do not interpret auto-triggered URL changes as the agent having submitted a search; verify whether Return was actually pressed.

**Search field identification:** The SkillHub search button (role `按钮`, label `搜索技能`) opens an inline text field (role `文本栏`). The button itself is not `settable`. Click the button first to expose the field, then target the revealed `文本栏` element for input.

**In-page Command+F:** Doubao Browser's native find bar (Chromium internal) is not exposed in the AX tree. Prefer the web application's own search mechanism. See `tested-gaps.md` P3.

**Small toolbar icons:** Toolbar buttons (`扩展程序`, `添加书签`, `ai_web_summary`) are correctly clickable through OCU. Popup menus appear as separate windows with distinct accessibility trees. Escape closes them and returns to the main window.

**Page replacement and index invalidation:** After a link click navigates to a new page, all element indices from the previous page become invalid. OCU correctly rejects stale indices with `unknown element_index`. Always read fresh state after navigation and re-identify targets from the new tree. (T073, T080 validated)

**Secondary actions:** The window element's `Raise` secondary action is supported and triggers a full state refresh. Element-specific secondary actions vary by element type. A rejected action name (e.g., `ShowMenu` on a link) is correct protocol behavior, not a defect. (T067 validated)

**Drag tool:** The `drag` tool accepts coordinate-based input and executes without errors. Visual verification of drag outcomes may require a screenshot; AX tree changes alone may not reflect drag results for all targets. (T069 validated)

**Cross-application state isolation:** Switching between Doubao Browser and TextEdit preserves each application's state independently. No cross-contamination observed. (T071, T076 validated)
