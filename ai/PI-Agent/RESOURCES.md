# LLM Agent 架构 Resources

## Knowledge

- [《深入理解 AI Agent：设计原理与工程实践》— 李博杰 (Bojie Li)](https://bojieli.github.io/ai-agent-book/)
  仓库内已有源码：`ai-agent-book/book/chapter1.md` ~ `chapter10.md`。全书围绕「Agent = LLM + 上下文 + 工具」展开，中文写就，配 103 个实验。Use for: 任何通用 Agent 架构概念（上下文工程、工具设计、记忆、评估、多 Agent），作为把 `pi-agent-core` 具体实现映射回通用理论的主参照。
  - Ch1 AI Agent 入门 → Agent 的核心公式与总体心智模型
  - Ch2 上下文工程 → 对应 `pi-agent-core` 的 `transformContext` / `harness/compaction`
  - Ch3 用户记忆和知识库 → 对应 `harness/session`（会话状态持久化）
  - Ch4 工具 → 对应 `harness/tools`、`AgentTool` 类型、`beforeToolCall`/`afterToolCall` 钩子
  - Ch5 Coding Agent 与通用 Agent → 对应 `Agent` 类整体设计取向
  - Ch6 交互：观察与动作空间的扩展 → 对应事件流（`AgentEvent`）与 attachment 支持
  - Ch7-10 评估 / 后训练 / 持续进化 / 多 Agent → 当前 mission 暂不深入（见 `MISSION.md` Out of scope）

- [`@earendil-works/pi-agent-core` README](../../pi/packages/agent/README.md)
  本地路径：`pi/packages/agent/README.md`。官方文档，包含 Quick Start、AgentMessage vs LLM Message、事件流时序图。Use for: 任何关于这个具体代码库 API 设计意图的权威说明——比parametric猜测更可信。
- [`@earendil-works/pi-agent-core` CHANGELOG](../../pi/packages/agent/CHANGELOG.md)
  本地路径：`pi/packages/agent/CHANGELOG.md`。Use for: 理解某个 API/字段为什么长成现在这样（设计演化史），排查「这个功能是不是新加的」。
- [`pi` 仓库根 README](../../pi/README.md)
  本地路径：`pi/README.md`。Use for: 理解 `packages/agent` 在整个 pi monorepo（CLI、provider、session backend 等）里的位置。
- 源码本身：`pi/packages/agent/src/agent.ts`、`agent-loop.ts`、`types.ts`、`harness/*`
  Use for: 最终真相来源。任何 README 或书里的说法，如果能在源码里找到对应实现，以源码为准。

## Wisdom (Communities)

- [pi Discord](https://discord.com/invite/3cU7Bz4UPx)
  `pi` 项目官方 Discord。Use for: 遇到设计取舍疑问（为什么这么设计而不是那么设计）、想核实自己的理解是否正确、想看真实用户/维护者怎么用这个包时使用。
- [`bojieli/ai-agent-book` GitHub 仓库](https://github.com/bojieli/ai-agent-book)（Issues / PR）
  Use for: 书中概念有疑问，或想看其他读者的实验心得。

## Gaps

- 目前没有找到专门讨论「TypeScript 编写的 Agent 框架内部实现」的中文社区/论坛，只能依赖源码 + Discord。如果后续学习中发现具体痛点（比如 compaction 策略、事件重放），可以再补充针对性资源。
