# 扩展 Codex A/B 滚动与资源证据

## 背景

V1.1 在实现 Adapter 前需要继续补齐 OCU V1.0 与 Codex 官方 Computer Use 的真实 Accessibility 配对证据，并解释测试期间的 CPU、GPU、上下文和动作路径膨胀。

## 变更

- 为配对运行器增加 `long-page-scroll` 场景。
- 明确稳定 ID 只用于定位当前 AX 行，工具参数必须使用该行当前的整数 `element_index`。
- 将未注入目标 Computer Use 后端的样本标为基础设施无效样本，并允许自动重试一次；无效样本不计入插件成功率。
- 区分全部工具尝试、成功调用和失败调用，避免恢复失败被遗漏。
- 记录 Codex JSONL 传输字节数，以及 OCU 工具结果中的文本与图片 Base64 字节数。
- 直接验证 V1.0 的 `disable_screenshot=true` 仍返回 JPEG，并把证据写入 A/B 报告和 V1.1 计划。
- 固定 Codex 官方 `1.0.1000502` wrapper 路径，排除 bundled Skill 发现偶发失败；严格基础配对重跑后双方均按 4 步通过。
- 建立 OCU V1.0 的 100 分权重评分卡，当前暂定 61 分，并明确未测试项不能视为已具备能力。

## 结果

- OCU V1.0 在真实 AX 滚动夹具上完成任务，但共经历 12 次工具尝试，最终通过滚动条控件点击恢复。
- Codex 官方单样本在 180 秒内未改变滚动偏移并超时。
- OCU 有效样本累计返回约 185,976 字节图片 Base64；冻结二进制的直接调用也证明 `disable_screenshot` 参数未生效。
- 固定官方 wrapper 后，`fixture-basic` 官方耗时约 35.766 秒、OCU 约 37.335 秒，双方都是 4 次调用；固定 wrapper 的官方滚动重跑仍在 120 秒后失败，说明该夹具的滚动差异不只是 Skill 发现成本。

## 验证

- `node --check scripts/run-codex-computer-use-ab.mjs`
- `git diff --check`
- `node scripts/run-codex-computer-use-ab.mjs --scenario=long-page-scroll --arms=ocu --repetitions=1 --timeout-ms=120000 --invalid-retries=1 --run-id=20260727-scroll-real-ocu-05`
- `node scripts/run-codex-computer-use-ab.mjs --scenario=long-page-scroll --arms=official --repetitions=1 --timeout-ms=180000 --invalid-retries=1 --run-id=20260727-scroll-real-official-01`（有效失败样本：超时且外部偏移保持 0）
