## 2026-07-26 23:40 | Task: 修正 A/B fixture 真值与真实 AX 路径

### 🤖 Execution Context
* **Agent ID**: Codex root task
* **Base Model**: GPT-5
* **Runtime**: Codex CLI 0.146.0-alpha.3.1 / macOS arm64

### 📥 User Query
> 持续执行 Codex 官方 Computer Use 与 OCU V1.0 的同案例测试，发现问题后记录并修正。

### 🛠 Changes Overview
**Scope:** A/B fixture、外部完成判断、Unicode/焦点场景

**Key Actions:**
- **真实路径**: 把测试 app 的显示名改为 `CodexABFixture`，避免 OCU 自动进入仓库专用 `FixtureBridge`。
- **真值刷新**: fixture 每 0.5 秒导出一次当前 UI 状态，覆盖 AX 直接改值但不触发文本代理回调的情况。
- **分层判定**: 运行器分别记录任务完成与方法符合度，并验证 `type_text` 后第一次状态读取是否已经出现目标文本。
- **构建一致性**: 每轮测试前做一次增量 fixture 构建，防止源码与已缓存测试 app 不一致。

### 🧠 Design Intent (Why)
如果一边走专用测试桥、另一边走真实 Accessibility，耗时和可靠性对比都无效；如果外部状态文件滞后，又会把真实成功误判为失败。两者必须先消除，后续结果才能指导 Runtime 与 Adapter 修改。

### 📁 Files Modified
- `apps/OpenComputerUseFixture/Sources/OpenComputerUseFixture/main.swift`
- `scripts/run-codex-computer-use-ab.mjs`
- `tests/harness/scenarios/codex-computer-use-ab.json`
- `artifacts/harness-ab/20260726-initial-codex-ab.md`
- `docs/histories/2026-07/20260726-2340-fix-ab-fixture-oracle.md`
