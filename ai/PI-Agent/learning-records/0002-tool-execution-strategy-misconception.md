# 纠正：谁决定工具怎么跑（模型点菜，harness 定怎么上菜）

用户在学完 Lesson 2 后一开始认为"调用几个工具、怎么执行"都是由 LLM 决定的。经过代码对照（`agent-loop.ts:418-426`）纠正为：**模型只决定「调几个、调哪些工具」**（一条 assistant 消息的 `content` 数组里可以放多个 `toolCall` 块）；**「这一批工具具体顺序执行还是并行执行」是 harness 层的决定**（`config.toolExecution` 配置 + 单个工具自带的 `executionMode: "sequential"` 声明，两者任一为真就强制顺序）。

**对后续教学的影响**：用户已经具备"模型负责决策内容、harness 负责执行策略"这条分界线的直觉，之后讲工具执行细节（Lesson 3：`beforeToolCall`/`afterToolCall`、并行 vs 顺序）可以直接在这条分界线上展开，不需要重新铺垫"模型 vs harness 该管什么"这个大前提。同时，用户对事件时序（`turn_end` vs `agent_end` 的关系、`turn_end` 对应"一次 LLM 调用 + 其触发的整批工具调用"而非"一次工具调用"）表现出主动追问、逐步精确化理解的学习风格——喜欢先给出自己的假设再让我验证/纠正，而不是被动接受讲解。
