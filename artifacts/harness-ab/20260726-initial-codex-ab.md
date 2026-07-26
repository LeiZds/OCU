# Codex 内部 A/B：首轮有效样本

## 结论

OCU V1.0 在两个首轮场景中均完成任务，且 `fixture-basic` 与 Codex 官方 Computer Use 使用相同的四步动作路径。复盘发现初版 fixture 的应用名触发了 OCU 仓库内置的专用 `FixtureBridge`，而官方插件走真实 Accessibility，因此 fixture 结果只能证明 Agent 路径与测试桥回归，不能用于宣称真实 Runtime 性能等价。运行器已改为使用 `CodexABFixture` 应用名，让两边都走真实 UI 路径。

## 有效配对

| 场景 | A：Codex 官方 | B：OCU V1.0 | 动作路径 | 结论 |
| --- | ---: | ---: | --- | --- |
| `list-apps` | 通过，80.391 秒 | 通过，26.512 秒 | `list_apps` | 双边通过 |
| `fixture-basic`（桥接预检） | 通过，69.369 秒 | 通过，31.634 秒 | `get_app_state → set_value → click → get_app_state` | 双边完成，但 OCU 触发专用桥；不计入 Runtime 性能结论 |

耗时包含模型、Harness、Skill 发现和工具调用的完整任务时间，不等同于 Runtime 单动作延迟。样本中官方 A 组消耗了更多时间和上下文，主要因为新 Codex CLI 任务对官方 Skill 的发现与装载路径存在波动；后续需要单独采集 Runtime 延迟，不能把这部分全部归因于官方 Computer Use。

配置限制：官方 Computer Use 只有在正常用户配置下才能暴露；OCU 使用 `--ignore-user-config` 加唯一冻结 MCP 入口，避免多插件工具面导致候选工具偶发不注入。因此当前总耗时和 Token 不是严格单变量 A/B，只能作 Harness 产品路径描述；功能任务仍使用相同 Codex 版本、默认模型、提示意图、app、初态和外部完成判断。

## 无效预检（不计入成功率）

- 使用 `--ignore-user-config` 时，Codex CLI 没有暴露官方 Computer Use；运行器已改为两边共用正常用户 Harness 配置，只在 B 组禁用官方插件并注入冻结 OCU。
- 裸 `OpenComputerUseFixture` 可执行文件无法被官方 Runtime 稳定识别为 macOS app；运行器已将其包装为固定 bundle ID 的 `.app`，并在每个 arm 前重新启动和清零。
- `.app` 初版仍使用 `OpenComputerUseFixture` 名称，会让 OCU 自动进入仓库专用 `FixtureBridge`，而官方走真实 UI；现改名为 `CodexABFixture`，保留外部真值文件，但禁用这一隐式快路径。

## 当前差距

- 静态哈希与 API 声明检查确认：官方版本 `1.0.1000502` 有 10 个工具，OCU V1.0 Runtime 只有 9 个工具，缺少 `select_text`。协议面覆盖为 90%，但这不是整体能力得分。
- 恢复、安全、多窗口、滚动、异步弹窗、截图几何与提示注入边界尚未形成有效配对。
- 当前每个场景只有 1 个有效配对；不足 30 个配对样本前只报告描述性结果。

`focus-unicode` 的真实 AX 首轮暴露了一个待修复问题：OCU 返回的状态没有让 Agent 明确确认文本框焦点，Agent 因此重复尝试默认、`accessibility`、`app_post` 点击，最终没有调用用户指定的 `type_text`，而是用完整 `set_value` 兜底。该场景会保留为 V1.1 的焦点可观测性与动作路径回归用例。

修正测试路径与 oracle 后的有效样本：

- OCU V1.0：一次有效重试在约 90.182 秒、12 次调用后完成；通过 `Tab → End → type_text` 恢复并在第一次 `type_text` 后验证成功。
- Codex 官方：在 180 秒上限内执行 32 次调用仍未使 `type_text` 生效，最终超时，文本停留在基础值。
- 两边都表现出焦点恢复成本高；该结果用于定位“焦点可观测性和输入恢复”问题，不据单样本宣称 OCU 整体优于官方。
- 一次 Codex 子任务未注入 OCU MCP，归类为 Harness 基础设施无效样本，不计入插件成功率。

`long-page-scroll` 的真实 AX 单样本结果：

- OCU V1.0：任务完成，外部真值从 `Scroll offset: 0` 变为 `Scroll offset: 138`；耗时约 78.027 秒。模型先重复调用 3 次无效 `scroll`，随后尝试 2 次失败的 secondary action、1 次失败的 `set_value`，最后通过滚动条控件点击完成；原始轨迹共 12 次工具尝试，说明结果正确但恢复路径明显膨胀。
- Codex 官方：180 秒超时，3 次 `scroll` 均未改变外部滚动偏移；共识别到 9 次 Computer Use 调用。该结果说明官方与 OCU 对同一个自定义 AX 滚动区采用的后备路径不同，不用于外推普通网页或原生长页面的整体优劣。
- 两组提示、应用、初态和外部完成判断一致；官方需要正常用户配置才能暴露 bundled Computer Use，OCU 使用隔离配置，因此跨 Harness 总时长和 Token 仍只作描述。

## 资源与截图缺口

V1.0 的 `get_app_state` Schema 声明了 `disable_screenshot`，但执行分发层没有读取该参数。使用冻结二进制直接调用 `get_app_state({app:"TextEdit", disable_screenshot:true})` 的实测结果仍包含 JPEG：总输出 43,201 字节，其中图片 Base64 41,164 字节，耗时约 4.189 秒。

在 `long-page-scroll` 的 OCU 有效样本中，模型每次都传入 `disable_screenshot=true`，Runtime 仍累计返回约 185,976 字节的图片 Base64，Codex 任务累计输入 Token 约 660,856。该数字是 Harness 的累计计量，不等同于单轮上下文窗口，但足以证明无用截图会显著放大传输和处理成本。V1.1 必须让该参数真正生效，并增加回归测试。

## 运行方式

```bash
make codex-ab SCENARIO=list-apps RUNS=1
make codex-ab SCENARIO=fixture-basic RUNS=1
make codex-ab SCENARIO=focus-unicode RUNS=1
make codex-ab SCENARIO=long-page-scroll RUNS=1
make surface-parity
```

原始 JSONL 与 stderr 保存在本地 `artifacts/harness-ab/runs/`，该目录默认不提交，避免把本机应用清单和大段模型日志推送到 GitHub。
