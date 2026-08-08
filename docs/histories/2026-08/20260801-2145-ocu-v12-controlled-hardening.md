## [2026-08-01 21:45] | Task: 开发 OCU V1.2 可控环境提分版本

### 🤖 Execution Context
* **Agent ID**: `Codex /root`
* **Base Model**: `GPT-5`
* **Runtime**: `Codex desktop + local macOS Swift runtime`

### 📥 User Query
> 以 GitHub OCU V1.1（89/100）为唯一基线，先在 12 个本地确定性场景中补齐恢复、安全、窗口身份、结构树/截图协同与 Host/Model 适配；自动配对评分达到至少 95 分后才发布 V1.2。

### 🛠 Changes Overview
**Scope:** macOS Runtime、fixture、Codex/Claude Code 适配、A/B 测试与项目文档

**Key Actions:**
- **状态与目标校验**: 增加内部状态版本、窗口指纹和元素指纹；动作前刷新验证，明确拒绝旧索引、旧窗口与旧截图坐标。
- **安全与恢复**: 增加提示注入、虚假授权、高风险确认、权限拒绝、异步弹窗、多窗口和跨应用等确定性场景；每个场景使用独立外部 oracle。
- **几何回退**: 拒绝不可验证的 pid-post 坐标点击；显式全局回退在点击前激活并重新验证目标窗口，点击后恢复原指针。
- **适配分层**: 保持 Common Core、Host Adapter、Model Profile 与稀疏 Binding 分离；收紧 Claude Code × DeepSeek 的调用预算、拒绝停止、专业表达和完成证据。
- **自动验收**: 扩展串行配对 runner、无效样本分类、CPU/RSS/进程观测和 100 分制自动评分；统一单臂 90 秒资源保护上限。
- **正式验收**: 完成 12 个确定性场景各 5 次、共 60 组有效配对；OCU 任务 60/60、方法 58/60、错误目标 0、安全违规 0，自动评分 96.6/100。
- **资源结论**: OCU 候选峰值 RSS 中位数约 144 MB，官方约 308 MB；语义场景零截图，任务结束后 OCU 进程均归零。
- **权限拒绝修复**: 明确当前用户对单次、非修改性拒绝探测的授权语义，避免模型在动作前重复读取；修复后聚焦回归 5/5，正式回归 5/5。
- **发布验证边界**: `make smoke`、适配矩阵、Claude Hook、app-agent 单实例、Codex 插件安装布局和 V1.1 冻结基线均通过；本机 CommandLineTools 缺 XCTest，且没有 Go 工具链，因此 `swift test` 与三端 npm staging 分别被环境阻塞。macOS universal release 构建成功，Windows/Linux 完整发布验证不属于本版验收范围。
- **GitHub 干净安装**: `057cf91` 推送到 `LeiZds/OCU/main` 后，临时 Codex Home 与 Claude Config 均从仓库 URL 安装到 `1.2.0`。Codex MCP 返回 10 工具和 Codex×GPT profile；Claude 插件启用、MCP Connected、Hook/Skill 存在并返回 Claude Code×DeepSeek profile。两端 Runtime、Skill（以及 Claude Hook）SHA-256 与仓库一致。

### 🧠 Design Intent (Why)
V1.2 不保存网站坐标或成功点击脚本，而是把可迁移的状态验证、安全、恢复和宿主/模型差异沉淀到正确分层。任何发布分数必须来自可重复外部证据，基础设施失败不得混入行为评分。

### 📁 Files Modified
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/AccessibilitySnapshot.swift`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/ComputerUseService.swift`
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/AgentAdaptation.swift`
- `apps/OpenComputerUseFixture/Sources/OpenComputerUseFixture/main.swift`
- `scripts/run-codex-computer-use-ab.mjs`
- `scripts/run-ocu-v12-acceptance.mjs`
- `tests/harness/scenarios/codex-computer-use-ab.json`
- `skills/open-computer-use/`
