# Open Computer Use V1.1：Claude Code Harness 适配计划

## 目标

以 GitHub `LeiZds/OCU` 当前 `main` 的 `54004e007dfb081754b3c03c93fb54696d3d35d4` 为 V1.0 代码基线，在不降低 Codex 同 Harness 表现的前提下，为 Claude Code Harness + DeepSeek 增加可版本化、可一键安装、可观测的宿主适配，并通过先 Codex 内部配对、后 Claude Code 黑盒回归的顺序验证 V1.1。TRAE CN 仅用于启动、承载和观察 Claude Code，不作为独立 Harness 研究对象。

## 范围

- 包含：
  - Codex 官方 Computer Use 与 OCU 的同 Harness 配对测试。
  - Claude Code 2.1.218 Harness 的本机可见行为研究；TRAE CN 3.3.74 仅记录为启动与承载环境。
  - Claude Code 正式插件包装、MCP 启动配置、Skill 暴露和必要的 turn/session 适配。
  - MCP 服务器指令预算、工具 Schema、动作后状态、Diff 基线和进程生命周期适配。
  - `select_text` 工具补齐及 Codex 官方十工具协议面回归。
  - 安装、运行、性能、稳定性和安全边界的测试记录。
- 不包含：
  - 猜测或复刻 Claude Code、Codex 未公开的内部系统提示词。
  - 为单个网站固化坐标或点击脚本。
  - 第一阶段同时验证 Windows/Linux 桌面 Runtime；本轮先以本机 macOS 和不同 Agent 宿主为范围。
  - 将 Codex 官方实现的专有二进制或代码复制到 OCU。

## 已确认基线

### OCU V1.0

- GitHub 基线：`LeiZds/OCU@54004e007dfb081754b3c03c93fb54696d3d35d4`。
- 仓库元数据仍写 `0.1.0`，后续需要统一为产品版本 `1.0.0`，V1.1 开发版使用 `1.1.0-dev`。
- GitHub 中的 V1.0 包含 macOS 预编译 App、Codex manifest、MCP 配置、Skill 和经验文件。
- Runtime 目前暴露 9 个工具，缺少 Codex 官方已有的 `select_text`；Skill 文档与真实工具面不一致。
- 当前本地源码工作区已有用户状态：`dist/Open Computer Use (Dev).app` 的追踪文件处于删除状态。冻结或构建前必须先解析运行制品来源，不能覆盖或误提交这些变化。

### Codex Harness

- Codex App：`26.721.41059`；Codex CLI：`0.146.0-alpha.3.1`。
- 官方 Computer Use 插件：`1.0.1000502`，通过持久化 `node_repl + @oai/sky` wrapper 使用。
- 官方协议面包含 10 个工具；优先 Accessibility Tree，截图以本地 `file://` URL 传递。
- 官方 Runtime 保留 Diff 状态、动作后自动稳定等待约 1 秒并在加载态延长至约 5 秒。
- Codex 的 Harness 可在同一次持久 JavaScript 会话中组合动作与验证读取，这是效率基准之一。

### Claude Code Harness（TRAE CN 仅为启动器和承载界面）

- Claude Code：`2.1.218`；TRAE CN 启动器：`3.3.74`；Claude Code 扩展入口是官方 `Anthropic.claude-code`。
- TRAE CN 当前启动 Claude Code 时使用 `/Users/leizi` 作为 cwd，导致 Claude Code Harness 把用户级多个 MCP 同时放入工具面：`cu-server`、上游 `open-computer-use`、旧路径 `open-computer-use-dev`、`webscout-mcp` 等。该现象归入 Claude Code 启动参数与配置作用域，不归入 TRAE Harness。
- 当前 `open-computer-use` 指向全局 npm `0.2.0`；`open-computer-use-dev` 指向旧工作副本，不是 GitHub 冻结的 V1.0。
- 当前目标大模型就是 `deepseek-v4-flash`。V1.1 的主要适配对象明确为 `Claude Code Harness + DeepSeek + OCU`，测试结果按这一产品栈记录，不再把 DeepSeek 视为额外兼容性分组。
- 扩展实际启动权限模式为 `acceptEdits`；用户配置里的默认模式并不等于每个 VS Code 会话的实际模式。
- Tool Search 当前不可用，多个 MCP Schema 可能被直接注入上下文。
- 旧 dev Runtime 曾在 Claude 日志中出现 5330 字符 instructions 被截断到 2048 字符；冻结的 GitHub V1.0 Runtime 实测为 2028 字符，未越过该阈值。V1.1 仍必须把关键不变量控制在 2048 字符以内，详细经验继续按需加载 Skill references。
- OCU MCP 连接耗时样本约 80ms–2866ms；进程在会话关闭时能收到 SIGINT 并干净退出。
- Claude Code 支持正式插件目录、`.claude-plugin/plugin.json`、根目录 `.mcp.json`、`${CLAUDE_PLUGIN_ROOT}`、插件 eval 和 GitHub marketplace 安装。

## 目标架构

```text
OCU Runtime / MCP（跨 Harness 共用）
├── Accessibility Tree、截图、动作与 Diff 状态
├── 十工具统一 Schema
└── 关键安全与验证不变量（紧凑 server instructions）

通用经验层（跨 Harness 共用）
├── 状态 → 单步动作 → 验证
├── 应用身份、URL、焦点、旧索引和安全边界
└── 条件经验 references

Host Adapters
├── Codex Adapter
│   ├── 保留现有 plugin manifest
│   └── 兼容持久状态、action-state 与 turn-ended
└── Claude Code Adapter
    ├── .claude-plugin/plugin.json + marketplace manifest
    ├── ${CLAUDE_PLUGIN_ROOT} 绑定的 V1.1 MCP 启动
    ├── namespaced Skill 与精简入口
    └── 评估 Stop/SessionEnd hook 是否需要通知 turn-ended

Model Profiles
├── DeepSeek Profile
│   ├── 限制可观察规划长度与单轮动作数量
│   ├── 强化“最新状态 → 一个动作 → 证据验证”
│   └── 规定失败预算、停止条件和输出格式
├── GPT Profile
└── 未来其他模型 Profile

Bindings（只保存组合特例）
├── claude-code + deepseek
├── codex + gpt
└── workbuddy + <model>
```

宿主特有行为只进入对应 Host Adapter；模型特有的提示约束进入 Model Profile；只有“某个 Harness 与某个模型组合时才出现”的差异，才进入 Binding。只有跨平台、跨模型都成立的规则才进入通用核心。这样更换模型时只需新增或校准 Model Profile 和少量 Binding，不重写整个 Harness Adapter。

模型适配不包含微调或修改模型权重。本项目能做的是优化 MCP instructions、工具描述、Skill/Prompt、上下文预算、可观察规划格式、动作粒度、验证规则和重试上限。我们不依赖或要求模型暴露隐藏思维链，只评价可观察的工具选择、动作路径、证据和结果。

## A/B 测试设计

### 第一阶段：Codex 同 Harness 配对

- A 组：Codex 官方 Computer Use `1.0.1000502`。
- B 组：冻结的 OCU V1.0；随后用同样用例回归 V1.1 候选版。
- 固定变量：同一 Codex 版本、同一模型与推理强度、同一应用版本、相同窗口尺寸、初始状态、权限和成功标准。
- 运行方式：A/B 串行、使用独立新任务；GUI 测试不并行。
- 探索期每例 3 次；P0 回归每例 5 次。至少累计 30 个有效配对样本后，才评价百分比差距；此前只报告描述性结果。

首轮用例：

1. 应用身份与初始状态读取。
2. 语义点击与动作后状态。
3. `set_value`、焦点验证和提交。
4. `type_text` 中文、emoji、组合字符。
5. `select_text`、光标前后定位和歧义消解。
6. Diff 状态与过期 `element_index` 恢复。
7. 长页面、滚动、增量和虚拟列表。
8. 弹窗、异步加载和错误恢复。
9. 同应用多窗口和错误窗口保护。
10. 跨应用非敏感数据搬运。
11. 截图、坐标和几何对齐。
12. 页面提示注入与高风险动作边界。

核心指标：

- 任务成功率、错误应用/窗口次数、安全违规次数。
- 工具调用数、动作数、状态读取数、无效重试数、恢复次数。
- 首次连接时间、任务总时长、单动作延迟和 p95 延迟。
- 状态文本字节数、截图字节数、上下文输入量和截断次数。
- 动作膨胀比、旧索引错误、焦点错误和未验证成功声明。

阶段门槛：错误窗口为 0、安全违规为 0；核心成功率与官方差距不超过 2 个百分点；动作膨胀不超过 1.15 倍；Codex 既有 P0 用例不得回退。

### 第二阶段：Claude Code Adapter 配对

- B0：Claude Code + 当前 V1.0 安装方式，作为宿主适配旧基线。
- B1：Claude Code + V1.1 正式插件，作为候选组。
- Codex 官方 A 组结果作为教官参考，不把跨 Harness 结果伪装成只改变一个变量的纯 A/B。
- Codex 使用官方 Computer Use 操作 TRAE CN 这个启动/承载界面，并监控其中的 Claude Code；Codex 的外层控制动作与 Claude Code Harness 内部的 OCU 动作分开记录。
- 使用专用测试工作区，避免 `/Users/leizi` 下多个无关 MCP 污染工具选择。
- 主测试锁定 `deepseek-v4-flash`，使优化目标始终是 Claude Code Harness 对 DeepSeek 调用 OCU 的适配效果。未来如果增加 Anthropic Claude 模型，只作为新的模型适配分组，不替换当前主基线。
- 分别测试显式调用 namespaced Skill 和自然语言自动触发；两者不能混成同一成功率。
- 权限分两条轨道：稳定回归轨使用预批准的本地 OCU 工具；产品体验轨使用 `acceptEdits/manual` 观察真实审批摩擦。

## 实施切片

1. **清理测试身份**：建立专用工作区和单一 V1.0/V1.1 MCP 入口，移除同名上游、旧 dev 和 `cu-server` 对测试任务的干扰。
2. **统一版本与制品**：修正 `1.0.0` 基线元数据，建立 `1.1.0-dev`，保证源码、Skill、manifest 和实际二进制哈希一致。
3. **协议对齐**：补齐 `select_text`，生成十工具 Schema parity 检查；纠正文档与实际工具面的偏差。
4. **压缩关键指令与模型 Profile**：把应用身份、状态后动作、焦点、旧索引、完成证据和安全边界压缩进 Claude 的 2048 字符服务器 instruction 预算；为 DeepSeek 增加短规划、单动作、证据验证和有限恢复约束。
5. **Claude 插件包装**：增加 `.claude-plugin/plugin.json`、marketplace manifest、`${CLAUDE_PLUGIN_ROOT}` MCP 启动配置和安装验证；Claude Code 专有配置不得进入 Codex Adapter。
6. **宿主生命周期**：验证 Claude MCP 会话内 Diff/索引是否持续；评估 Stop/SessionEnd hook 对 `turn-ended` 和 cursor 清理的价值，避免无必要 Hook。
7. **Codex 内部配对**：先完成官方 vs V1.0，再验证 V1.1 不回退。
8. **Claude Code 黑盒配对**：由 Codex 通过 TRAE CN 界面监控 Claude Code + DeepSeek 执行同一组任务，记录路径、错误和资源消耗。
9. **回归与发布**：定向失败例 3 次、P0 5 次，更新 history、版本、安装说明并直接推送 GitHub，不创建 PR。

## 风险

- 风险：本地存在三个不同 OCU 二进制与两个同名 MCP，容易测试错版本。
  - 缓解：每轮记录二进制 SHA-256、server version、Skill hash 和启动命令。
- 风险：Claude 当前模型不是 Claude，导致把模型差异误判为 Harness 差异。
  - 缓解：锁定模型并独立维护模型兼容性成绩单。
- 风险：Claude 截断 MCP instructions。
  - 缓解：关键约束控制在 2048 字符内，详细内容放 Skill references，并验证实际日志无截断。
- 风险：Claude 插件安装成功但仍调用全局 npm 版本。
  - 缓解：启动脚本只解析 `${CLAUDE_PLUGIN_ROOT}` 内的制品，返回构建身份供测试记录。
- 风险：Claude 适配修改导致 Codex 退化。
  - 缓解：宿主特有配置隔离；每个切片先跑 Codex P0 回归。
- 风险：把 Harness、模型和插件三者写成不可拆的深度绑定，新增平台或模型时形成组合爆炸。
  - 缓解：分别维护 Host Adapter、Model Profile 和最小 Binding；组合层只允许存放有复现实证的交互特例。
- 风险：GitHub 下载的 macOS 二进制触发 Gatekeeper、签名或权限身份变化。
  - 缓解：分别验证本机源码安装、GitHub ZIP 安装和全新目录安装；发布前明确签名/公证边界。

## 验证方式

- 静态检查：
  - `claude plugin validate .`
  - 工具 Schema parity 检查必须覆盖十工具。
  - manifest、Skill、Runtime 和 GitHub 制品版本一致性检查。
- Runtime：
  - `swift test`
  - `make smoke`
  - `make agent-smoke`
- Codex 手工检查：
  - 官方与 OCU 使用独立新任务、相同案例、相同初始状态。
- Claude Code 手工检查：
  - 专用工作区只加载 V1.1 插件。
  - 日志确认 server instructions 不被截断、MCP 只启动一次、进程干净退出。
  - Codex 通过 TRAE CN 承载界面全程监控 Claude Code 的任务路径；TRAE 的界面动作不计入 Claude Code Harness 内部动作指标。

## 完成标准

- V1.1 可以通过 GitHub 仓库按文档安装为 Claude Code 插件，Skill 与 MCP 自动绑定同一版本。
- Claude Code 不再依赖用户全局 npm `0.2.0` 或旧 dev 路径。
- Claude 日志中不存在 OCU server instructions 截断。
- OCU 对齐 Codex 官方十工具协议面，并通过 `select_text` 回归。
- Codex P0 用例无回退，Claude Code 目标用例达到约定门槛。
- 测试报告能分开回答 Runtime 差距、Codex Harness 差距、Claude Harness 差距和模型差距。

## 进度记录

- [x] 确认 V1.0 GitHub SHA、仓库元数据和当前本地脏状态。
- [x] 确认 Codex、Claude Code Harness，以及 TRAE CN 启动/承载边界。
- [x] 定位当前 Claude 实际 MCP、Skill、模型、权限和指令截断问题。
- [x] 建立 V1.1 分层架构和两阶段测试设计。
- [x] 从 GitHub `54004e0` 建立隔离 V1.1 工作区，并清除旧 OCU 运行安装、进程、MCP 指向、Skill 和 Codex 缓存。
- [x] 建立唯一 V1.0 可复现运行入口；哈希门禁确认 Runtime `0.2.1`、MCP instructions `2028` 字符及 9 工具真实协议面。
- [x] 完成 Codex 内部 V1.0 首轮基线配对与暂定评分；剩余场景继续作为 V1.1 回归覆盖，不用当前样本宣称统计等价。
- [x] 实现十工具 parity、紧凑指令和 Claude 插件包装。
- [ ] 完成 Codex V1.1 回归（首轮五场景已采集；四组保留为有效描述性样本，滚动组因 fixture 初始位置错误作废并已修复；剩余重复样本受本机 Codex 额度窗口暂时限制）。
- [ ] 完成 Claude Code + DeepSeek 黑盒回归（TRAE CN 仅作启动和观察界面）。
- [ ] 更新版本、history、安装说明并直接推送 GitHub。

## 决策记录

- 2026-07-26：把 GitHub `54004e0` 定义为 V1.0 代码基线，而不是把当前全局 npm `0.2.0` 当作 V1.0。
- 2026-07-26：V1.1 使用“通用核心 + Codex Adapter + Claude Code Adapter”，不把 Claude 专有约束写进所有宿主共用路径。
- 2026-07-26：先做 Codex 同 Harness 配对，再做 Claude Code 跨 Harness适配；跨 Harness 结果只作为产品栈对照，不冒充纯插件 A/B。
- 2026-07-26：根据用户纠正，主目标产品栈固定为 `Claude Code Harness + DeepSeek + OCU`；TRAE CN 仅是 Claude Code 的启动器和承载界面，Anthropic Claude 模型不属于本轮主基线。
- 2026-07-26：模型适配与 Harness 适配分层维护。平台差异进入 Host Adapter，模型差异进入 Model Profile，只有可复现的组合差异进入 Binding，避免对三者做不可拆的硬绑定。
- 2026-07-26：旧全局 npm OCU、旧 Claude MCP/Skill 和旧 Codex 缓存已停止并移入废纸篓；含未提交修改的源码目录只解除运行引用，不直接删除。
- 2026-07-26：后续 GitHub 更新直接提交和推送，不创建 PR。
- 2026-07-26：冻结的 V1.0 通过二进制、Skill 双 SHA-256 和 MCP 握手三重校验；旧 dev 的 5330 字符截断记录不得再归因于 GitHub V1.0。
- 2026-07-26：Codex 配对运行器已覆盖 `list-apps` 与 `fixture-basic`。两组首个有效配对均双边通过；`fixture-basic` 两边都是 `get_app_state → set_value → click → get_app_state`。当前样本仅作描述，不用于宣称统计等价。
- 2026-07-26：无效预检确认两个测试约束：`--ignore-user-config` 会让官方 Computer Use 不可用；裸 Swift fixture 不具备稳定 macOS app 身份。运行器现保留同一用户 Harness 配置，并把 fixture 包装成固定 bundle ID 的 `.app`。
- 2026-07-27：配对运行器增加基础设施无效样本重试、真实 AX 长页面滚动场景，以及工具结果文本/图片传输量记录。OCU 单样本完成滚动但需要 12 次工具尝试；官方单样本 180 秒超时且滚动偏移未改变。该结果只用于定位恢复路径，不作整体优劣结论。
- 2026-07-27：确认 V1.0 的 `disable_screenshot` 只存在于 Schema，执行分发层未读取；直接调用和 Agent 轨迹都证明即使传 `true` 仍返回 JPEG。该缺口列为 V1.1 P0 性能修复。
- 2026-07-27：严格 `fixture-basic` 配对固定官方 `1.0.1000502` wrapper，排除 Skill 发现波动后，官方 35.766 秒、OCU 37.335 秒，双方均以相同 4 步真实 AX 路径完成。OCU 仍额外返回约 102,944 字节图片 Base64。
- 2026-07-27：以官方为 100 分教官基准，OCU V1.0 首轮暂定 61/100；未测试项按未证明扣分，后续只能由新增证据提分。
- 2026-07-27：V1.1 macOS Runtime 已补齐 `select_text`；`disable_screenshot=true` 在捕获阶段跳过 ScreenCaptureKit，动作刷新也不再生成不会返回的截图。10-tool fixture smoke、12 组合适配矩阵、Codex/Claude manifest 校验均通过。
- 2026-07-27：Codex、Claude Code、WorkBuddy Host Adapter 与 GPT、DeepSeek Model Profile 分层落地；Binding 在未显式指定时只为 `Codex × GPT` 和 `Claude Code × DeepSeek` 自动选择。最长组合指令为 1950 UTF-8 字节。
- 2026-07-27：并发启动验证曾复现两个 App Agent 争用同一 socket；Runtime 增加跨进程文件锁后，4 个并发 Claude 客户端均连接成功且只留下 1 个常驻 Agent。该检查已固化为 `make app-agent-check`。
- 2026-07-27：V1.0 Skill 与二进制校验改为读取冻结提交并在构建目录物化旧 Runtime，V1.1 更新当前 Skill 和 `dist` 后仍能通过 `make baseline-v1`。
- 2026-07-27：提交前真实 launcher 探测发现，先启动 generic App Agent 后 Claude launcher 会错误继承 generic profile。MCP server 改为在每条连接的请求环境内延迟创建；generic warmup 后 4 个并发 Claude Code × DeepSeek 连接均返回正确 Binding，且只保留一个 Agent。
- 2026-07-27：同一审计发现 Swift 编译失败后 App 打包脚本仍可能签名旧二进制。构建函数现显式传播失败并检查可执行产物，避免错误版本进入后续 A/B。
- 2026-07-27：V1.1 Codex 配对运行器增加候选 commit/二进制/Skill 哈希门禁、固定模型与推理强度、进程树 CPU/RSS 采样，并把 `select_text` 重复词歧义消解升级为真实 AX 自动化场景。
- 2026-07-27：`select_text` 单臂校准中，OCU V1.1 以 5 次调用直接完成；官方首次把 `set_value + select_text` 放在同一 JS block，第二步因状态尚未刷新失败，随后读取状态并恢复完成。正式评分继续使用外部 fixture oracle，同时把失败调用和恢复成本单独计入，不因组合 block 的整体失败状态否认已经生效的第一步。
- 2026-07-27：V1.1 首轮正式配对中，`list_apps`、基础真实 AX、Unicode 焦点和重复文本选择四组样本可用；OCU 四组均完成任务和方法约束，官方 Unicode 最终状态正确但在 33 次调用后只能用 `set_value` 收尾，未满足 `type_text` 方法约束。样本仍少于 30 个，不作统计等价结论。
- 2026-07-27：长页面样本复盘发现 fixture 标签显示 offset 0 时系统 scrollbar 实际位于底部；fixture 改为 flipped document view、启动时强制归零，并把真实 bounds offset作为导出状态。修复后官方 `scroll(down, 1)` 一次把 offset 从 0 推到 150。
- 2026-07-27：OCU 对真实 scroll area 会忽略 `AXScrollDownByPage` 的无效/无变化结果并误报成功。Runtime 现优先对 settable AX scrollbar 做可观察的页步长调整，再回退到 AX action 和 pid-targeted event；确定性测试证明 down 从 0 到 0.2/offset 161，up 可回到 0，全程不需要全局物理指针。
- 2026-07-27：A/B 候选启动器曾优先选择已打包 `dist`，而报告身份校验的是 `.build/release`。新增测试专用启动器，正式样本只运行刚构建并校验哈希的候选二进制；Codex 使用额度不足也改记为 infrastructure-invalid，不再污染产品失败率。
- 2026-07-28：Claude Code `2.1.218` 的 print 模式在 `--bare` 下只加载插件元数据，不注入插件 MCP；DeepSeek 因而尝试 `Bash("ocu list_apps")`，失败后仍错误宣布成功。隔离运行器现明确禁用该组合，使用 project-only setting sources，并要求初始化事件中只能有一个已连接的 V1.1 插件 MCP。
- 2026-07-28：A/B 运行器新增 `claude` arm，真实解析 Claude stream-json；成功必须同时满足目标工具调用、无工具错误、外部 fixture 状态和最终格式，不能再用最终文本中的成功标记代替工具证据。
- 2026-07-28：Claude Code + DeepSeek 首轮隔离黑盒覆盖 `list-apps`、基础填值点击、重复文本选择、Unicode 焦点输入和长页面滚动。前四个可完成任务；基础、选择和滚动均使用最短语义路径，Unicode 因文本字段没有真正获得焦点导致 `type_text` 失败后用 `set_value` 恢复。DeepSeek 在所有动作样本中都给精确标记附加了总结，因此方法一致性未通过。
- 2026-07-28：权限缺失样本中，DeepSeek 在首个不可重试错误后又读取三次并尝试 `list_apps`。Runtime 权限错误现携带“环境不变时不可重试”的明确停止门，Claude Code × DeepSeek Binding 要求不再调用 OCU；DeepSeek Profile 增加精确最终标记单独输出规则。组合指令为 2026 UTF-8 字节，仍低于 Claude 的 2048 字节预算。
- 2026-07-28：真实 Unicode 样本证明 `click(element_index=text-field)` 只保持窗口焦点，未让可编辑控件获得 AX 焦点。Runtime 的无动作 click fallback 已扩展到 `AXTextField`、`AXTextArea`、`AXTextView` 和 `AXComboBox`，以便后续 `type_text` 走真实焦点路径；候选 App 重建后的实时复测仍待完成。
- 2026-07-28：本机存在两个相同 `com.ifuryst.opencomputeruse.dev` Bundle ID 的旧/新 App，且 Dev App 使用 ad-hoc CDHash 签名，造成 TCC 条目看似开启但当前进程仍无权限。当前 V1.1 路径已显式加入 Accessibility 与 Screen Recording；每次重建 Dev App 仍可能改变 CDHash，发布前必须把稳定签名/权限身份作为独立门禁。
- 2026-07-28：Unicode 焦点失控样本曾达到 37 次 OCU 调用、180 秒超时、峰值 121.8% CPU 和 433 MB RSS。根因是可编辑控件命中测试先对窗口执行 Raise 并提前返回；Runtime 现优先设置文本控件 `AXFocused`，同一任务以 `get_state → set_value → click → type_text → get_state` 五步、17.4 秒完成。
- 2026-07-28：Claude Code 插件新增会话级 Harness Hook。相同输入产生两次相同结果后拒绝下一次调用；连续两次错误或 30 次总调用触发停止门；用户明确要求精确最终标记时，Stop Hook 最多校正一次。真实四次无变化读取验证第四次被拒绝。
- 2026-07-28：Claude Code 直接失败的工具调用不会触发 `PostToolUse`，而是触发 `PostToolUseFailure`。插件已同时订阅两类完成事件，连续失败门不再依赖工具返回正常结果；定向回归确认两个直接失败后下一次调用会在执行前被拒绝。
- 2026-07-28：干净候选的权限缺失回归证明，单纯依据用户提示中的精确标记做 Stop 校正会把失败回复伪装成成功。Stop Hook 现只整理模型已包含的成功标记，并要求本轮有成功 OCU 证据且没有失败调用；错误回复永不被升级为成功。
- 2026-07-28：Claude 插件 MCP server 从重复的 `open-computer-use` 缩短为 `ocu`。DeepSeek 曾把暴露名中的下划线/连字符重拼三次；Host Adapter 与测试提示现要求只选择 Harness 已暴露的精确名称。复测基础、Unicode、重复文本选择和滚动分别以 4、5、4、3 次调用通过。
- 2026-07-28：系统设置授权操作中，Codex 官方 Computer Use 的可见结构索引与实际命中曾不一致，误移除“豆包”辅助功能条目；已立即恢复应用条目并还原原来的关闭状态。此后权限操作只使用目标 Bundle ID 的 `tccutil reset`、明确的添加按钮和完整 App 路径，不再按列表行执行删除。
