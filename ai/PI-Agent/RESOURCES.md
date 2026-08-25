# LLM Agent 架构 Resources

## Knowledge

- [Pi Agent Book（dg-ai-notes）](https://dg-ai-notes.pages.dev/)
  专门讲 `pi-agent-core`（也就是本 mission 参照的这个具体代码库）的中文教程站，分两条并行的 track，**从 2026-08-24 起作为本 workspace 结构的主要参照**（用户指定）。理论 track（源码精读，10 章）和实践 track（部署落地，7 章）分开编号，每章都是独立页面，带字数标注。已用的六节课大致落在理论 track 前几章的范围内，具体映射见下表；后续新课优先对齐这个目录的章节顺序和覆盖范围，缺口（尤其是 M04 模型调用、M07 事件驱动完整版、M10 会话管理，以及整个实践 track）是下一步的候选主题。
  - M01 开篇 `/modules/ch01-overview` → 已被 Lesson 1（大图）覆盖
  - M02 三层架构 `/modules/ch02-three-layer-arch` → 已被 Lesson 1（Model–Harness）覆盖
  - M03 Agent Loop `/modules/ch03-agent-loop` → 已被 Lesson 2、6（turn 循环、Agent vs runAgentLoop）覆盖；**也是 steering 机制的主参照章节**
  - M04 模型调用 `/modules/ch04-model-call` → 部分覆盖（Lesson 13：`thinkingLevel` → `config.reasoning` → `streamFunction` 调用链、`text_*`/`thinking_*`/`toolcall_*` 三组流式事件的对称结构），`pi-ai` provider 内部翻译逻辑仍未展开
  - M05 工具系统 `/modules/ch05-tools` → 已被 Lesson 3（tool call 生命周期）覆盖
  - M06 消息系统 `/modules/ch06-messages` → 已被 Lesson 4（context pipeline）覆盖
  - M07 事件驱动 `/modules/ch07-event-driven` → 部分覆盖（Lesson 1 事件时序、Lesson 6 processEvents），未成体系
  - M08 上下文工程 `/modules/ch08-context-engineering` → 部分覆盖（Lesson 4），未单独成课
  - M09 上下文压缩 `/modules/ch09-compaction` → 已被 Lesson 5 覆盖
  - M10 会话管理 `/modules/ch10-session` → 已被 Lesson 10（Session 树/fork）覆盖，注意 Lesson 10 讲的是 `packages/coding-agent` 真正在用的实现，不是 `packages/agent` 里那套未采用的 `Record`/`runId` 设计
  - P01-P07（环境部署、系统提示词、工具定义、事件监听、上线）→ 未覆盖，按 `MISSION.md` 目前不要求动手接入真实 API，暂列为候选而非硬性任务

- [《深入理解 AI Agent：设计原理与工程实践》— 李博杰 (Bojie Li)](https://bojieli.github.io/ai-agent-book/)
  仓库内已有源码：`ai-agent-book/book/chapter1.md` ~ `chapter10.md`。全书围绕「Agent = LLM + 上下文 + 工具」展开，中文写就，配 103 个实验。Use for: 任何通用 Agent 架构概念（上下文工程、工具设计、记忆、评估、多 Agent）的理论落地，作为把 `pi-agent-core` 具体实现映射回通用理论的参照——`dg-ai-notes` 讲这个代码库本身，这本书讲代码背后的通用设计原理，两者互补。
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

- [Learn Claude Code（learn.shareai.run）](https://learn.shareai.run/zh/)
  「从 0 到 1 构建 nano Claude-Code-like agent」，20 节课，每课只加一个机制，按五个正交模块分组：工具与执行(4)、规划与控制(5)、记忆管理(2)、并发与调度(2)、多 Agent 平台(7)。**注意这个站是 Claude Code 特定的，不是 `pi-agent-core`**——跟这两份 `pi-agent-core` 参照（dg-ai-notes、`packages/agent` 源码）不是同一个具体实现，但架构模式（核心循环、工具分发、权限 harness、多 Agent 协议）是通用的。Use for: 想从"自己动手搭一个"的角度巩固已经学过的架构概念时对照参考，尤其是跟本 workspace 已覆盖主题直接对应的几节——不要把它的具体 API/文件路径跟 `pi-agent-core` 的搬到一起用，只借架构思路。
  - s01 The Agent Loop / s02 Tool Use → 对应 Lesson 2、3
  - s03 Permission → 对应 Lesson 8（工具权限控制）
  - s07 Skill Loading → 对应 Lesson 9（Skill 渐进式加载）——两边独立实现，可以对照着看设计取舍有什么不同
  - s08 Context Compact / s09 Memory → 对应 Lesson 5、Lesson 10（Session 树）
  - s04 Hooks / s05 TodoWrite / s06 Subagent / s10-s20 → 目前 mission 范围未覆盖（多 Agent 协作按 `MISSION.md` Out of scope 暂不深入）

## Wisdom (Communities)

- [pi Discord](https://discord.com/invite/3cU7Bz4UPx)
  `pi` 项目官方 Discord。Use for: 遇到设计取舍疑问（为什么这么设计而不是那么设计）、想核实自己的理解是否正确、想看真实用户/维护者怎么用这个包时使用。
- [`bojieli/ai-agent-book` GitHub 仓库](https://github.com/bojieli/ai-agent-book)（Issues / PR）
  Use for: 书中概念有疑问，或想看其他读者的实验心得。

## Gaps

- 目前没有找到专门讨论「TypeScript 编写的 Agent 框架内部实现」的中文社区/论坛，只能依赖源码 + Discord。如果后续学习中发现具体痛点（比如 compaction 策略、事件重放），可以再补充针对性资源。
