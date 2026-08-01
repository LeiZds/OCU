# 质量评分

## 评分标准

- `A`：覆盖完整、行为稳定、文档清楚、运行风险低。
- `B`：整体可接受，但还有明确短板。
- `C`：能用，但需要针对性补强。
- `D`：脆弱、缺少规范，或很多行为尚未定义。

## 当前水位

| 区域 | 评分 | 原因 | 下一步 |
| --- | --- | --- | --- |
| 产品面 | B | Swift/macOS V1.2 候选继续保持 10-tool surface，并新增状态版本、窗口指纹、旧索引拒绝、受控几何回退，以及 Host Adapter / Model Profile / Binding 分层。 | 补完因 Codex usage limit 中断的校准与 60 组正式验收；达标前不发布。 |
| Windows runtime | C | 已新增独立 Go `.exe`，通过 Windows UI Automation + Win32 window message 暴露同样 9 个 tools、MCP server 和 `call --calls`；默认不再自动启动 app、执行 `SetFocus`，或让 `type_text` 走可能抢前台的 UIA text fallback，并已接入 npm bundled artifact 分发，但仍是功能性第一版。 | 补交互式桌面 smoke、Windows fixture、installer/signing，以及更原生的 Go UIA 实现或更稳定的 bridge。 |
| Linux runtime | C | 已新增独立 Go binary，通过 Python GI / AT-SPI2 暴露同样 9 个 tools、MCP server 和 `call --calls`；Ubuntu GNOME VM 已跑通 `list_apps`、MCP tools list 和 Text Editor 8-tool sequence，并已接入 npm bundled artifact 分发，但截图在 GNOME Wayland 下仍只能 best-effort，coordinate input 也不是通用后台模型。 | 补 Linux fixture、可重复 smoke runner、portal/compositor screenshot 路径，以及更原生的 Go D-Bus/libatspi bridge。 |
| 架构文档 | B | 顶层结构、fixture bridge、app 模式和验证路径已经落文档。 | 后续补 release artifact、code signing / notarization 和 host 集成方式。 |
| 测试 | B | macOS smoke 覆盖 10 个 tools；适配矩阵覆盖 12 个 Host/Model 组合；V1.2 有 12 个本地场景、独立外部 oracle、串行配对、资源记录和自动评分。开发校准已完成 30 组以上有效配对，并修复了几何焦点问题。 | Codex usage limit 恢复后补齐每场景 3 次并执行 60 组干净验收；完整 Xcode/XCTest 环境下补跑 `swift test`。 |
| 可观测性 | B | A/B runner 自动记录工具路径、错误目标、超时、截图/文本量、CPU/RSS、进程数、退出残留和外部证据，并将 usage limit 等基础设施样本标记为无效。 | 补统一产品日志级别和 release artifact 诊断入口。 |
| 安全 | B | V1.2 候选增加提示注入、虚假授权、高风险确认和权限拒绝的确定性测试；pid-post 坐标点击改为拒绝，显式全局回退会激活并重验目标窗口、恢复原指针。 | 正式 60 组验收保持零违规，并继续推进 session approval 与敏感 app policy。 |
