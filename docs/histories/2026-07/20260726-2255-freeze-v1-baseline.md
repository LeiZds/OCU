## 2026-07-26 22:55 | Task: 冻结 OCU V1.0 基线

### 🤖 Execution Context
* **Agent ID**: Codex root task
* **Base Model**: GPT-5
* **Runtime**: Codex App 26.721.41059 / macOS arm64

### 📥 User Query
> 以 GitHub 当前 OCU V1.0 为基点，按六阶段计划继续开发和测试。

### 🛠 Changes Overview
**Scope:** V1.0 基线、MCP 协议探测、V1.1 执行计划

**Key Actions:**
- **可复现入口**: 增加哈希门禁启动器，只允许运行 GitHub `54004e0` 中的指定 V1.0 二进制。
- **协议校验**: 增加通用 stdio MCP 探针和基线检查，锁定二进制、Skill、协议版本、instructions 长度及九工具真实协议面。
- **证据纠正**: 区分旧 dev Runtime 的 5330 字符截断记录与 GitHub V1.0 实测的 2028 字符 instructions。

### 🧠 Design Intent (Why)
V1.0 必须是可重复识别的唯一对照组，后续 A/B 才不会把旧 npm、旧 dev Runtime 或不同 Skill 误当成同一版本。

### 📁 Files Modified
- `Makefile`
- `scripts/probe-mcp-tools.mjs`
- `scripts/check-ocu-v1-baseline.mjs`
- `scripts/run-ocu-v1-baseline.sh`
- `tests/harness/baselines/ocu-v1.0.json`
- `docs/exec-plans/active/20260726-claude-code-harness-adapter-v1-1.md`
- `docs/histories/2026-07/20260726-2255-freeze-v1-baseline.md`
