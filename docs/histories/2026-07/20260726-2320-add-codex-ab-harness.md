## 2026-07-26 23:20 | Task: 建立 Codex Computer Use 配对测试

### 🤖 Execution Context
* **Agent ID**: Codex root task
* **Base Model**: GPT-5
* **Runtime**: Codex App 26.721.41059 / Codex CLI 0.146.0-alpha.3.1 / macOS arm64

### 📥 User Query
> 在 Codex 内使用相同案例对官方 Computer Use 与冻结的 OCU V1.0 做 A/B，并持续记录和迭代。

### 🛠 Changes Overview
**Scope:** Harness A/B runner、场景目录、实验记录

**Key Actions:**
- **串行配对运行器**: 用独立 Codex 任务运行官方与 OCU，两臂固定版本、初态、提示意图和完成判断。
- **外部完成证据**: 为 `fixture-basic` 在每臂前重置 fixture，并从独立状态文件验证输入值与计数器。
- **macOS app 身份**: 自动把 fixture 包装成固定 bundle ID 的 `.app`，避免裸可执行文件导致官方 Runtime 无法发现。
- **覆盖目录**: 建立 12 类测试场景和 100 分权重框架；当前自动化首两个场景。
- **隐私与负载控制**: A/B 串行、不默认截图，原始本机日志写入被忽略目录，只提交脱敏结论。

### 🧠 Design Intent (Why)
同一个模型说“成功”不能证明 Computer Use 真正完成任务。运行器把 Host、模型、初态、目标和验证方式固定下来，并用独立真值判断结果，才能区分 Runtime、Harness 和模型路径差异。

### 📁 Files Modified
- `.gitignore`
- `Makefile`
- `scripts/run-codex-computer-use-ab.mjs`
- `tests/harness/scenarios/codex-computer-use-ab.json`
- `artifacts/harness-ab/20260726-initial-codex-ab.md`
- `docs/exec-plans/active/20260726-claude-code-harness-adapter-v1-1.md`
- `docs/histories/2026-07/20260726-2320-add-codex-ab-harness.md`
