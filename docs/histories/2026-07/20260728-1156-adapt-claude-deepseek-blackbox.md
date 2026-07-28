## [2026-07-28 11:56] | Task: 校准 Claude Code × DeepSeek 黑盒调用

### 🤖 Execution Context
* **Agent ID**: `Codex`
* **Base Model**: `GPT-5`
* **Runtime**: `Codex desktop / macOS`

### 📥 User Query
> 按六阶段继续推进 OCU V1.1，先在隔离环境验证 Claude Code Harness + DeepSeek，再由 Codex 监控 TRAE CN 内的真实调用。

### 🛠 Changes Overview
**Scope:** Claude Code Harness 运行隔离、stream-json 证据校验、DeepSeek Profile、权限停止门与文本焦点

**Key Actions:**
- **[Harness isolation]**: 证明 Claude Code `2.1.218` 的 `--bare` print 会加载插件元数据但不注入插件 MCP；测试轨改为 project-only setting sources、独立工作目录和单一 V1.1 插件入口。
- **[Evidence runner]**: A/B 运行器增加 `claude` arm，解析实际工具调用、工具错误、MCP 初始化、模型身份、外部 fixture 状态和最终文本，避免“没有调用 OCU 但仍输出成功”的假阳性。
- **[Black-box coverage]**: 隔离回归覆盖应用列表、基础填值点击、重复文本选择、Unicode 焦点输入和长页面滚动；基础、选择和滚动均完成目标，Unicode 暴露文本字段焦点缺口。
- **[DeepSeek profile]**: 精确最终标记必须单独输出；权限或后端错误在环境不变时是终止条件，不得重复 OCU 调用或改走 `list_apps`。
- **[Runtime error contract]**: 权限错误明确标记为环境变化前不可重试，只允许在用户确认权限变化后重试。
- **[Editable focus]**: click 的语义焦点 fallback 扩展到文本字段、文本区域、文本视图和组合框，为后续 `type_text` 保留真实输入路径。
- **[Editable focus ordering]**: 可编辑控件在附近命中测试之前优先设置 `AXFocused`，避免命中窗口 Raise 后提前返回并丢失文本焦点。
- **[Harness circuit breaker]**: Claude 插件增加 PreToolUse/PostToolUse/PostToolUseFailure 会话守卫，拒绝已产生两次相同结果的相同调用、连续错误（包括未产生正常工具结果的直接失败）和极端总调用；Stop Hook 只校正用户明确要求的精确最终标记。
- **[No false success]**: Stop Hook 只在至少存在一次成功 OCU 证据、整轮没有失败调用且模型自己已经输出目标标记时移除多余叙述；权限错误等失败回复不会再被改写成成功标记。
- **[Tool namespace]**: Claude 插件 MCP server 缩短为 `ocu`，并要求 DeepSeek 只选择 Harness 暴露的精确工具名，禁止重拼命名空间。
- **[Unicode fidelity]**: DeepSeek Profile 要求保留精确 Unicode code point 与 normalization；测试提示显式区分 U+0065 U+0301 和 U+00E9。
- **[Permission identity]**: 定位到相同 Dev Bundle ID 与 ad-hoc CDHash 导致的 TCC 身份混淆；当前候选路径已显式加入 Accessibility 与 Screen Recording，稳定签名被列为发布门禁。

### 🧠 Design Intent (Why)
Claude Code Harness、DeepSeek 和 OCU 必须分别可观测。最终回复不是成功证据；只有真实工具路径与外部状态一致时才算完成。模型提示负责减少错误选择，Runtime 错误负责提供不可误解的停止信号，点击实现负责消除可复现的焦点缺口。

### 📁 Files Modified
- `scripts/run-codex-computer-use-ab.mjs`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/AgentAdaptation.swift`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/ComputerUseService.swift`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/Errors.swift`
- `packages/OpenComputerUseKit/Tests/OpenComputerUseKitTests/OpenComputerUseKitTests.swift`
- `hooks/hooks.json`
- `hooks/ocu-loop-guard.mjs`
- `scripts/test-claude-hook-guard.mjs`
- `skills/open-computer-use/references/host-adapters.md`
- `skills/open-computer-use/references/model-profiles.md`
- `skills/open-computer-use/references/bindings.md`
- `docs/exec-plans/active/20260726-claude-code-harness-adapter-v1-1.md`

### ✅ Validation
- `make smoke`
- `make adaptation-check`，Claude Code × DeepSeek instructions 为 2029 UTF-8 字节，低于 2048 字节预算。
- Claude Code + DeepSeek `list_apps`：1 次 OCU 调用完成，无 Bash、无其他 MCP。
- 基础任务：`get_app_state → set_value → click → get_app_state`，fixture 值正确且 Counter 为 1。
- 重复文本选择：4 次调用完成，外部状态确认第二个 `value` 被选中。
- 长页面滚动：3 次调用完成，offset 从 0 变为 161。
- Unicode 焦点最终回归：5 次调用、17.4 秒完成；`click` 保持 `fixture-input` 焦点，`type_text` 首次成功追加，最终外部状态和精确标记均通过。
- 基础、Unicode、重复文本选择、长页面滚动复测分别以 4、5、4、3 次调用通过。
- 真实循环守卫验证：前三次相同状态读取允许，第四次在执行前被 Harness 拒绝。
- Hook 单元回归确认连续两个 `PostToolUseFailure` 会让下一次 OCU 调用在执行前被拒绝。
- 权限缺失实测暴露 Stop Hook 曾在工具失败后强制输出成功标记；定向回归现确认失败回复保持失败，不产生目标标记。
- 提交 `c703ae5` 的 Codex 最终候选配对覆盖五个 P0 场景；OCU 五组均完整通过。应用发现、基础操作、Unicode、精确选择和滚动分别为 13.7s/1、34.1s/4、44.8s/7、39.1s/5、17.9s/3 次调用。
- 同一配对中官方 Unicode 虽最终状态正确，但经历 44 次调用、127.8 秒且首次 `type_text` 验证失败；OCU 保持分解 Unicode 并按指定方法完成。其余四组双方均完整通过。
- 五组 OCU 峰值 RSS 为 153–180MB、进程峰值均为 1，且工具结果图片传输为 0；阶段评分从 V1.0 的 61 分提高到 V1.1 的 86 分。
- `swift test --filter OpenComputerUseKitTests.testActivationOnlyClickFallbackKeepsEditableFocusPaths` 仍被仓库既有 Swift/XCTest 工具链问题阻断：`StandaloneCursorSupportTests` 无法加载 `XCTest`。
