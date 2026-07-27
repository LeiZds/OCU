## [2026-07-27 11:27] | Task: 修复滚动行为与 A/B 测试完整性

### 🤖 Execution Context
* **Agent ID**: `Codex`
* **Base Model**: `GPT-5`
* **Runtime**: `Codex desktop / macOS`

### 📥 User Query
> 按六阶段继续推进 OCU V1.1，并用 Codex 官方 Computer Use 做同案例对照。

### 🛠 Changes Overview
**Scope:** macOS scroll Runtime、真实 AX fixture、Codex A/B 候选门禁与无效样本分类

**Key Actions:**
- **[Fixture invariant]**: 把滚动文档改成 flipped 坐标系，启动时强制归零，并始终从真实 clip bounds 导出 offset，消除“标签为 0、scrollbar 已在底部”的错误基线。
- **[Observable scroll]**: 对 settable AX scrollbar 优先按页调整 `AXValue`；只有语义路径不可用时才尝试 `AXScroll*ByPage` 和 pid-targeted event。无变化的 AX action 不再被当成有效滚动。
- **[Bidirectional proof]**: 最新构建在真实 AX fixture 上向下从 value 0 到 0.2 / offset 161，向上可回到 0；未开启系统级物理指针路径。
- **[Candidate identity]**: 新增 Codex A/B 专用 launcher，只执行刚构建并校验 SHA-256 的 `.build/release` Runtime，避免实际运行已打包旧制品。
- **[Infrastructure classification]**: Codex 额度或 rate limit 改为 infrastructure-invalid，可重试但不计入 OCU/官方失败率。
- **[Regression coverage]**: 增加页步长方向、range clamp 单元测试；保持十工具 smoke、12 组合适配矩阵和 App Agent 单实例检查。

### 🧠 Design Intent (Why)
工具返回成功必须能被界面状态证明。滚动优先使用非侵入、可观察的 Accessibility 值路径，同时保留现有回退边界。A/B 报告里的 commit、哈希和实际执行二进制必须是同一个对象，否则性能与能力结论都不可采用。

### 📁 Files Modified
- `packages/OpenComputerUseKit/Sources/OpenComputerUseKit/ComputerUseService.swift`
- `packages/OpenComputerUseKit/Tests/OpenComputerUseKitTests/OpenComputerUseKitTests.swift`
- `apps/OpenComputerUseFixture/Sources/OpenComputerUseFixture/main.swift`
- `scripts/launch-open-computer-use-codex-ab.sh`
- `scripts/run-codex-computer-use-ab.mjs`
- `docs/ARCHITECTURE.md`
- `docs/exec-plans/active/20260726-claude-code-harness-adapter-v1-1.md`

### ✅ Validation
- `swift build -c release --product OpenComputerUse`
- `make smoke`
- `make adaptation-check`
- `make app-agent-check`
- 真实 AX fixture 上官方向下滚动：offset 0 → 150。
- 真实 AX fixture 上 OCU 向下滚动：scrollbar 0 → 0.2，offset 0 → 161；向上回到 0。
- `swift test --filter OpenComputerUseKitTests.testScrollTargetValue` 仍被本机既有 Swift/XCTest 工具链问题阻断：`StandaloneCursorSupportTests` 无法加载 `XCTest`；不是本次测试代码的编译失败。
