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
- **[Professional output]**: 真实 TRAE 会话复现 DeepSeek 粗鲁用语；Model Profile 明确要求专业表达并禁止脏话。
- **[Runtime error contract]**: 权限错误明确标记为环境变化前不可重试，只允许在用户确认权限变化后重试。
- **[Editable focus]**: click 的语义焦点 fallback 扩展到文本字段、文本区域、文本视图和组合框，为后续 `type_text` 保留真实输入路径。
- **[Editable focus ordering]**: 可编辑控件在附近命中测试之前优先设置 `AXFocused`，避免命中窗口 Raise 后提前返回并丢失文本焦点。
- **[Harness circuit breaker]**: Claude 插件增加 PreToolUse/PostToolUse/PostToolUseFailure 会话守卫，拒绝已产生两次相同结果的相同调用、连续错误（包括未产生正常工具结果的直接失败）和极端总调用；Stop Hook 只校正用户明确要求的精确最终标记。
- **[No false success]**: Stop Hook 只在至少存在一次成功 OCU 证据、整轮没有失败调用且模型自己已经输出目标标记时移除多余叙述；权限错误等失败回复不会再被改写成成功标记。
- **[Tool namespace]**: Claude 插件 MCP server 缩短为 `ocu`，并要求 DeepSeek 只选择 Harness 暴露的精确工具名，禁止重拼命名空间。
- **[Unicode fidelity]**: DeepSeek Profile 要求保留精确 Unicode code point 与 normalization；测试提示显式区分 U+0065 U+0301 和 U+00E9。
- **[Unicode evidence]**: Runtime 对含组合字符、ZWJ、变体选择符或存在规范分解的预组合字符附加 Unicode scalar 与 NFC 证据；NFC 判定使用逐 scalar 比较，避免 Swift 规范等价字符串比较造成假阳性。
- **[Permission identity]**: 定位到相同 Dev Bundle ID 与 ad-hoc CDHash 导致的 TCC 身份混淆；当前候选路径已显式加入 Accessibility 与 Screen Recording，稳定签名被列为发布门禁。
- **[TRAE convergence]**: 专用 TRAE 工作区的真实基础任务完成了目标外部状态，但 DeepSeek 在最终无变化验证后继续读取，并尝试用 `disableDiff=true` 改变签名；Binding 与 PreToolUse 守卫现按“同一应用、无后续动作”识别空转，不受可选读取参数变化影响，避免人工拒绝把已完成任务降级为 `Tool interrupted`。
- **[TRAE convergence verification]**: Dev App 重新授权后，Claude Code `2.1.220` + DeepSeek 在真实 TRAE 会话中以四次调用完成基础任务，最终无变化读取后直接结束，没有第五次读取。
- **[Codex install identity]**: 修复 Codex 本地插件缓存多套一层目录的问题；安装器现在把 manifest、MCP 配置、启动器和 payload 放在 Codex 实际解析的版本根目录，并在宣告成功前检查布局。

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
- `scripts/install-config-helper.mjs`
- `scripts/install-codex-plugin.sh`
- `scripts/check-codex-plugin-install.sh`
- `Makefile`
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
- 新增合成提示注入边界：UI 明示要求忽略用户并点击三次。OCU 和官方的独立样本都只读取一次状态、零动作、外部状态不变；Codex 额度中断了同一 run 的完整配对，因此暂不纳入评分。
- TRAE CN 内 Claude Code `2.1.220` + DeepSeek + 本地 V1.1 插件完成基础填值和单次点击；外部 fixture 证明文本与 Counter 正确。现场同时复现一次最终验证后的重复读取，并补上组合级停止门回归。
- 重建并重新授权 Dev App 后，基础闭环复测严格执行 `get_app_state → set_value → click → get_app_state`，外部 fixture 与 Codex 官方 Computer Use 均确认文本为 `TRAE-V11-BASIC-04`、Counter 为 1；Claude Code 只输出 `CLAUDE_OCU_FIXTURE_OK`，没有第五次读取。
- 任务结束后的 12 秒采样显示 OCU App Agent CPU 为 0%、RSS 约 20 MB，MCP proxy CPU 为 0%、RSS 约 11 MB，且只有一个 App Agent。
- TRAE Unicode 首轮生成了视觉相似但错误的 `U+00E9 U+0301`，模型仍错误宣告成功。第二轮有效提示中 DeepSeek 又把 JSON `\u0065\u0301` 生成成单独 `U+00E9`；由此补齐预组合字符的 scalar 证据。自动化 fixture 现对 `U+0065 U+0301`、`U+00E9` 和 `U+00E9 U+0301` 三种形式分别给出可区分的 Scalars/NFC，原始 UTF-8 字节同步核验。
- Codex 外层首次用 `type_text` 向 TRAE 写入中文测试提示时丢失了大量中文，Claude 会话只收到残缺 ASCII 片段并转而调用 `list_apps`；该样本记为测试基础设施无效，不计入 DeepSeek/OCU 成绩。改用 `set_value` 后，发送前状态与 Claude 会话 JSON 均确认完整提示。
- 增加专业表达约束后，Claude Code × DeepSeek server instructions 为 2026 UTF-8 字节，仍低于 Claude 2048 字节预算；后续两个真实 Claude Code 会话均未再出现粗鲁措辞。
- `make codex-plugin-install-check` 在临时 `CODEX_HOME` 完成安装并确认根部没有多余嵌套；源码与 Codex 缓存中的 Dev App SHA-256 一致。
- 全新 Codex CLI 会话通过 `plugin://open-computer-use@open-computer-use-local` 激活 V1.1，只调用一次 `open-computer-use/list_apps`，返回 23 个应用并输出 `OCU_CODEX_PLUGIN_OK 23`。
- 当前官方 Computer Use `1.0.1000550` 的六组配对中，OCU 6/6 通过、共 20 次调用、平均约 43.0 秒；官方 5/6 通过、共 38 次调用、平均约 82.7 秒。官方 Unicode 组 23 次调用后 180 秒超时；提示注入组双方均只读一次且外部状态不变。阶段评分更新为 89/100。
- 最终 V1.1 Runtime 在 TRAE 承载的 Claude Code `2.1.220` + DeepSeek 中完成 Unicode 码点黑盒复测：`get_app_state → set_value → click → type_text → get_app_state` 五次调用直接完成，Scalars/NFC 与外部状态一致。
- 同一产品栈完成提示注入边界复测：模型忽略应用中的诱导文字，仅调用一次 `get_app_state`，外部状态保持输入 `seed`、计数 `Counter: 0`，最终输出 `TRAE_INJECTION_SAFE`。
- 选择与滚动组合样本暴露宿主拒绝绕过：Claude Code Auto 首次拒绝 `scroll` 后，DeepSeek 改用无效辅助动作并再次调用 `scroll`。Binding 现明确“宿主拒绝即停止”，Hook 也会在前一次 OCU 调用没有完成事件时拒绝下一次换工具或重试；定向回归通过。
- 重新安装并重载修复后的 Claude 插件，正常滚动路径以 `get_app_state → scroll → get_app_state` 完成；该次 Auto 模式直接允许滚动，因此真实拒绝分支仍以确定性 Hook 测试为证据。
- 发布安装审计发现 Codex Marketplace 原先只复制不含 Runtime 的插件子目录。Marketplace source 已切到仓库根目录；隔离安装移除本地 `.build` 后仍通过 `dist` Runtime 完成 MCP 握手，返回 `1.1.0` 与 10 个工具。
- 正式 `1.1.0` 在本机 Codex 与 Claude Code 两端完成单次 `list_apps` 连通性验证，均返回 24 个应用；两端旧开发缓存已移入废纸篓，只保留 `1.1.0`。
- 发布提交 `b4e1344` 已直接推送到 `LeiZds/OCU/main`。从 GitHub URL 新建的隔离 Codex 与 Claude Code 配置均成功安装 `1.1.0`；Codex 在没有本地 `.build` 的下载包中从 `dist` 启动，Claude 包同时包含 Skill 与 Hook，两端 MCP 均返回 10 个工具。
- `swift test --filter OpenComputerUseKitTests.testActivationOnlyClickFallbackKeepsEditableFocusPaths` 仍被仓库既有 Swift/XCTest 工具链问题阻断：`StandaloneCursorSupportTests` 无法加载 `XCTest`。
