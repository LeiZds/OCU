## [2026-07-27 10:24] | Task: 增加 V1.1 Agent 适配层

### 🤖 Execution Context
* **Agent ID**: `Codex`
* **Base Model**: `GPT-5`
* **Runtime**: `Codex desktop / macOS`

### 📥 User Query
> 以 GitHub V1.0 为基线，把 OCU 拆成通用核心、Host Adapter、Model Profile 和少量 Binding；优先适配 Claude Code + DeepSeek，同时保持 Codex 能力并继续 A/B 测试。

### 🛠 Changes Overview
**Scope:** macOS Runtime、Codex/Claude 插件包装、Skill、fixture、测试脚本与 V1.0 基线

**Key Actions:**
- **[Agent adaptation]**: 增加 Codex、Claude Code、WorkBuddy Host Adapter，GPT、DeepSeek Model Profile，以及自动选择的稀疏 Binding；所有组合的服务器指令保持在 2048 UTF-8 字节内。
- **[Protocol parity]**: macOS Runtime 补齐 `select_text`，将 element index Schema 收敛为整数，并把 fixture/smoke 扩展为 10-tool 回归。
- **[Resource control]**: `disable_screenshot=true` 在捕获阶段真正跳过截图；动作后的语义刷新不再捕获无用图片；`disableDiff` 和动作状态开关从 Schema/启动变量落到真实执行路径。
- **[Host packaging]**: 分离 Codex 与 Claude Code 启动器，增加 Claude marketplace/manifest，并确保本地源码优先运行当前 V1.1 构建。
- **[Lifecycle]**: 给 macOS App Agent 增加跨进程单实例锁；4 个并发 Claude 客户端只保留 1 个常驻权限 Agent。
- **[Profile isolation]**: MCP server 改为在每条 app-agent 连接的请求环境内延迟创建，避免先启动的 generic profile 污染后续 Claude Code × DeepSeek 连接；并把 generic warmup → 4 Claude clients 固化为回归。
- **[Build integrity]**: App 打包脚本在 Swift 构建失败或没有产出可执行文件时立即失败，不再继续签名和包装旧二进制。
- **[Baseline integrity]**: V1.0 校验改为从冻结提交读取 Skill 和二进制，并将旧 Runtime 解压到构建目录，不再与 V1.1 工作文件冲突。

### 🧠 Design Intent (Why)
Host、模型和组合差异必须独立演进，不能把 Claude Code × DeepSeek 的经验硬编码进所有 Agent。性能优化也必须发生在截图捕获和进程生命周期层，而不只是减少最终文本。V1.0 对照必须在 V1.1 替换发行制品后仍可重放。

### 📁 Files Modified
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/AgentAdaptation.swift`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/TextSelection.swift`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/ComputerUseService.swift`
- `apps/OpenComputerUse/Sources/OpenComputerUse/MacOSAppAgentProxy.swift`
- `scripts/check-agent-adaptation.mjs`
- `scripts/check-app-agent-singleton.mjs`
- `.claude-plugin/plugin.json`
- `.codex-plugin/plugin.json`
- `skills/open-computer-use/SKILL.md`

### ✅ Validation
- macOS 10-tool fixture smoke 与 visual cursor idle smoke 通过。
- 12 个 Host/Model 组合、自动 Binding、整数索引 Schema 和 2048-byte 指令预算检查通过。
- Codex 与 Claude 插件清单校验通过；generic warmup 后 4-client Claude profile 隔离与 App Agent 单实例压力检查通过。
- `swift test` 仍被本机 Command Line Tools 缺少 `XCTest` 模块阻断；这是既有工具链问题，未作为代码通过证据。
