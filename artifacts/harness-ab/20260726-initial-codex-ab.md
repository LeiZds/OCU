# Codex 内部 A/B：首轮有效样本

## 结论

OCU V1.0 在两个已覆盖的简单场景中均通过，且 `fixture-basic` 与 Codex 官方 Computer Use 使用相同的四步动作路径。目前只能说明基本工具选择与操作闭环成立，不能据此宣称能力已等价或给出最终 100 分。

## 有效配对

| 场景 | A：Codex 官方 | B：OCU V1.0 | 动作路径 | 结论 |
| --- | ---: | ---: | --- | --- |
| `list-apps` | 通过，80.391 秒 | 通过，26.512 秒 | `list_apps` | 双边通过 |
| `fixture-basic` | 通过，69.369 秒 | 通过，31.634 秒 | `get_app_state → set_value → click → get_app_state` | 双边通过，外部 fixture 真值一致 |

耗时包含模型、Harness、Skill 发现和工具调用的完整任务时间，不等同于 Runtime 单动作延迟。样本中官方 A 组消耗了更多时间和上下文，主要因为新 Codex CLI 任务对官方 Skill 的发现与装载路径存在波动；后续需要单独采集 Runtime 延迟，不能把这部分全部归因于官方 Computer Use。

## 无效预检（不计入成功率）

- 使用 `--ignore-user-config` 时，Codex CLI 没有暴露官方 Computer Use；运行器已改为两边共用正常用户 Harness 配置，只在 B 组禁用官方插件并注入冻结 OCU。
- 裸 `OpenComputerUseFixture` 可执行文件无法被官方 Runtime 稳定识别为 macOS app；运行器已将其包装为固定 bundle ID 的 `.app`，并在每个 arm 前重新启动和清零。

## 当前差距

- OCU V1.0 Runtime 只有 9 个工具，缺少官方已有的 `select_text`。
- 恢复、安全、多窗口、滚动、异步弹窗、截图几何与提示注入边界尚未形成有效配对。
- 当前每个场景只有 1 个有效配对；不足 30 个配对样本前只报告描述性结果。

## 运行方式

```bash
make codex-ab SCENARIO=list-apps RUNS=1
make codex-ab SCENARIO=fixture-basic RUNS=1
```

原始 JSONL 与 stderr 保存在本地 `artifacts/harness-ab/runs/`，该目录默认不提交，避免把本机应用清单和大段模型日志推送到 GitHub。
