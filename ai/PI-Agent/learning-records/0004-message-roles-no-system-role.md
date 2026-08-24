# 纠正:LLM Message 的三种角色里没有 "system"

用户在学完 Lesson 4 后,把「三种角色」理解成 user/ai/system。经代码对照(`packages/ai/src/types.ts:421-467`)纠正为:`Message` 的角色只有 `user`/`assistant`/`toolResult` 三种(**没有 `system`**);系统提示词(system prompt)根本不是一条消息,而是 `Context` 接口上单独的字符串字段 `systemPrompt`(`packages/ai/src/types.ts:521-522`),跟 `messages` 数组是并列关系,不参与 role 的枚举——这也是为什么 Lesson 1 的表格里写的是「`systemPrompt` + `messages`」而不是「三种 message」。

这个误解的来源大概是类比了其他常见 LLM API(不少确实有 `role: "system"` 的消息形式),但 pi-agent-core/pi-ai 的设计里,系统提示词被拿出到消息数组之外单独管理——对应第二章「静态前缀 + 轨迹」结构:系统提示词和工具定义是完全不变的静态前缀,`messages` 才是随交互增长的轨迹;把 systemPrompt 拿出 messages 数组正是这个结构在类型层面的体现。

**对后续教学的影响**:以后提到「消息角色/三种角色」时,要显式说明 systemPrompt **不是**一种 message role,而是上下文的静态前缀,避免用户用别的 API 的心智模型类比过来。这个点值得在 Lesson 4 对应的参考卡片里补一条,防止以后回顾时再次踩坑。
