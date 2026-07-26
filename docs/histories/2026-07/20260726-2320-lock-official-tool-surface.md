## 2026-07-26 23:20 | Task: 锁定官方 Computer Use 工具面

### 🤖 Execution Context
* **Agent ID**: Codex root task
* **Base Model**: GPT-5
* **Runtime**: Codex Computer Use 1.0.1000502 / OCU V1.0

### 📥 User Query
> 以 Codex 官方 Computer Use 为 100 分教官基准，确认 OCU 的具体能力差距。

### 🛠 Changes Overview
**Scope:** 官方基线、工具协议面校验

**Key Actions:**
- **官方基线**: 锁定官方 Skill 哈希、版本和十工具声明。
- **双边校验**: 从官方 Skill 解析真实 API 声明，并与 OCU V1.0 的哈希门禁 MCP 工具面比较。
- **边界清晰**: 输出 90% 协议面覆盖，同时明确它不是整体 Computer Use 能力评分。

### 🧠 Design Intent (Why)
文档可能过期，工具数量也不能代表行为能力。先用版本、哈希和运行时证据锁定协议差异，后续才能针对 `select_text` 实现与行为回归。

### 📁 Files Modified
- `Makefile`
- `scripts/check-computer-use-surface-parity.mjs`
- `tests/harness/baselines/codex-official-1.0.1000502.json`
- `artifacts/harness-ab/20260726-initial-codex-ab.md`
- `docs/histories/2026-07/20260726-2320-lock-official-tool-surface.md`
