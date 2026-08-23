# Mission: 理解 LLM Agent 架构（以 pi-agent-core 为参照实现）

## Why
用户是熟练的 TypeScript 开发者，但对 LLM Agent 框架的设计还是新手。他希望系统性地掌握「生产级 Agent」的通用架构模式（事件流、工具执行、上下文管理、会话状态等），并以 `pi/packages/agent`（`@earendil-works/pi-agent-core`）这个真实、结构清晰的开源实现作为具体参照，而不是停留在抽象概念上。掌握之后，他应该能读懂/复用任意 Agent 框架的核心设计，甚至自己动手改造或搭建一个。

## Success looks like
- 能画出并解释 `Agent` 类、`agent-loop.ts`、`types.ts` 三者之间的关系（外壳状态管理 vs. 纯函数式循环核心）
- 能准确复述 `prompt()` 调用后的事件序列（`agent_start → turn_start → message_start/update/end → tool_execution_* → turn_end → agent_end`），并说出每个事件在 UI/状态管理中的作用
- 能解释 `AgentMessage → transformContext → convertToLlm → Message[]` 这条上下文处理管线，并说明为什么需要区分「App 消息」和「LLM 消息」
- 能独立阅读 `harness/` 下的一个子模块（tools / session / compaction / env 任选）并总结它解决的问题
- 能用「Agent = LLM + 上下文 + 工具」的公式（来自《深入理解 AI Agent》第一章）解释这个代码库里各个模块分别对应公式里的哪一部分

## Constraints
- 用户偏好中文授课
- 用户目前没有表达时间预算限制，按多次会话渐进推进
- 学习应紧密结合 `pi/packages/agent` 的真实源码，不要脱离代码库空谈理论
- 优先复用仓库内已有的高质量资源（`ai-agent-book`、`pi-agent-core` 自带的 README/docs），不要凭空编造知识点

## Out of scope
- 暂不深入 `@earendil-works/pi-ai`（LLM provider 层/流式协议本身）的实现细节，除非为理解 agent 包所必需
- 暂不深入多 Agent 协作、模型后训练、Agent 评估体系（书中第 7-10 章），除非用户明确要求或已完成核心单 Agent 架构的学习
- 暂不要求用户实际拿到 API Key 跑通真实 LLM 调用，除非用户主动提出想要动手实践
