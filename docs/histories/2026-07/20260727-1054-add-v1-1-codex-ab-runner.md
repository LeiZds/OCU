## [2026-07-27 10:54] | Task: 扩展 V1.1 Codex 配对运行器

### 🤖 Execution Context
* **Agent ID**: `Codex`
* **Base Model**: `GPT-5`
* **Runtime**: `Codex desktop / macOS`

### 📥 User Query
> 在 Codex 内用相同案例比较官方 Computer Use 与 OCU V1.1，记录能力、性能和恢复差距，再据此迭代。

### 🛠 Changes Overview
**Scope:** Codex A/B 运行器、真实 AX fixture、场景清单和资源观测

**Key Actions:**
- **[Candidate gate]**: 默认候选切到 V1.1；运行前构建并验证 commit、Runtime/Skill SHA-256、版本、十工具和 Codex × GPT profile，脏工作区默认拒绝正式样本。
- **[Fair pairing]**: 两臂固定 `gpt-5.6-sol` 与 high reasoning，统一忽略 rules、使用 ephemeral session，并继续串行、交替臂顺序和外部 fixture oracle。
- **[Selection scenario]**: 自动化重复文本的 `select_text` 歧义消解；fixture 从真实 field editor 导出当前选择，避免只相信 Agent 或工具返回。
- **[Performance evidence]**: 每 500ms 采样 Codex 进程树的 CPU、RSS、进程数和 OCU 子进程数，并记录工具文本、图片 Base64、transport 字节和 token 使用。
- **[Parser calibration]**: 官方 `node_repl` 可在一个 JS block 内组合多个 `sky` 调用；工具存在性按实际调用记录判断，失败和恢复另外计数。OCU 进程计数只匹配真实 launcher/native runtime，不匹配提示词中的产品名称。

### 🧠 Design Intent (Why)
V1.1 不能只靠十工具 smoke 提分；配对样本必须证明 Agent 实际选择了正确工具、外部 UI 状态达标、没有测错二进制，并把速度、上下文和资源成本与任务成功分开记录。

### 📁 Files Modified
- `scripts/run-codex-computer-use-ab.mjs`
- `apps/OpenComputerUseFixture/Sources/OpenComputerUseFixture/main.swift`
- `tests/harness/scenarios/codex-computer-use-ab.json`
- `Makefile`

### ✅ Validation
- OCU V1.1 `list_apps` 单臂试跑通过。
- 官方 `list_apps` 单臂试跑通过。
- OCU V1.1 `select_text` 外部 oracle 通过：输入未改变、Counter 保持 0、选中文本为 `value`。
- 官方 `select_text` 首次把 `set_value + select_text` 合并后第二步失败，但刷新状态后恢复并完成；该试跑用于校准“组合调用只能按整块判定”的事件解析限制，不作为最终配对结论。
- 10-tool fixture smoke 与 visual cursor idle smoke 继续通过。
