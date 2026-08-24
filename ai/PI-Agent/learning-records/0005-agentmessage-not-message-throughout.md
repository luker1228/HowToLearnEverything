# 纠正:不是"LLM Message 贯穿始终",而是 AgentMessage 贯穿始终

用户在 Lesson 4 讲完"为什么需要两种消息"之后,提出的猜测是反过来的:"LLM message 贯穿始终才对"——即整个 Agent 循环从头到尾都该只用 LLM 认识的三种角色,不需要 `AgentMessage` 这层超集。

用反例纠正:`coding-agent/src/core/messages.ts:29-40` 的 `BashExecutionMessage`,专门对应 `!!command`(双感叹号)这种"执行但不发给 LLM"的场景,带一个 `excludeFromContext?: boolean` 字段。这个字段在 `Message` 类型上无法表达——`UserMessage` 的语义本身就是"即将发给 LLM 的一条消息",没有办法在这个类型上同时表达"这条消息真实发生过,但不要发给模型"。`convertToLlm`(`harness/messages.ts:152-156`)对 `excludeFromContext` 为真的消息直接 `return undefined`,把它从要发的 `Message[]` 里剔除,但它一直留在 `AgentMessage[]` 轨迹里(UI 能看到完整执行记录)。

准确的模型应该是:`AgentMessage`(App 记住的完整轨迹)才是从会话开始到结束**贯穿始终**存在的东西;`Message`(LLM 认识的子集)只在每次要发 API 请求前,由 `convertToLlm` **现算**出来的一个临时投影,而且这个投影每次可能都不同(取决于 `excludeFromContext`、`transformContext` 裁剪逻辑等)。

**对后续教学的影响**:以后讲 `AgentMessage`/`Message` 的关系时,可以直接用 `excludeFromContext` 这个反例开场,比空谈"App 需要记更多东西"更有说服力——它精确指出了"只用 LLM Message"这个方案在类型语义上会卡在哪(无法表达"发生过但不发送"这种状态)。已同步进 [reference/0004-context-pipeline.html](../reference/0004-context-pipeline.html) 的第二条 callout。
