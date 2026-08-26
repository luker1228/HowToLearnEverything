# 如何设计一个 compact tool

如果只记一句话，我建议你记这个：

> compact 不是“让 LLM 总结一下”，而是一个分层的上下文管理系统：**60% 用 hint 软减压，90% 做硬压缩，爆窗时 compact + retry**。

这套思路，基本可以理解成吸收了三家的长处：

- **pi** 的优点：把 compact 看成一个 **checkpoint**，心智模型稳定
- **deepseek** 的优点：**调用前检查压力**，先 prune，再 compact，爆窗还能 retry
- **Claude Code** 的优点：不是只会整体摘要，而是先做 **热上下文瘦身**，必要时再走更重的 compact

所以，一个好用的 compact tool，不应该只有一个 summary prompt，而应该有完整的分层流程。

---

## 一、compact 到底在解决什么问题

每次调用模型，都会把当前上下文重新带进去。

所以你真正要解决的，不是“怎么写一个摘要 prompt”，而是下面 3 件事：

1. **不要让上下文一路膨胀到爆窗**
2. **压缩之后还能继续工作**
3. **尽量少丢关键状态**

换句话说，compact 的目标不是“压得漂亮”，而是：

> **把旧历史变短，但让下一个模型还能无缝接手。**

---

## 二、一个我推荐的总体设计

我建议把 compact tool 设计成 4 层：

1. **Normal mode**：上下文健康，正常工作
2. **Soft pressure mode**：超过 60%，给模型塞一个 hint，软减压
3. **Hard compact mode**：超过 90%，系统强制压缩
4. **Emergency recovery**：已经爆窗，立刻 compact + retry

你可以把它想成一个渐进式的节流系统，而不是“一刀切摘要器”。

---

## 三、基本流程图

```text
[Before next request]
          |
          v
   Measure context usage
          |
          +---- < 60% ----------------------> Normal mode
          |
          +---- 60% ~ 90% ------------------> Soft pressure mode
          |                                     - inject compact hint
          |                                     - ask model to be concise
          |                                     - avoid repeating long tool outputs
          |                                     - optional mini-checkpoint by model
          |
          +---- >= 90% ----------------------> Hard compact mode
                                                1) deterministic prune
                                                2) re-measure
                                                3) if still too large:
                                                   LLM summary old history
                                                4) rebuild context
                                                5) continue request
          |
          +---- prompt-too-long / overflow --> Emergency compact + retry once
```

如果只看主干，就是这 4 句话：

- **60% 以下**：正常
- **60%~90%**：hint 软压缩
- **90% 以上**：系统硬压缩
- **爆窗**：紧急压缩并重试

---

## 四、60% 的 hint 机制：为什么有必要

这是你提的那个关键点，而且我认为是对的。

### 它的作用不是正式 compact
60% 这层并不真正改写历史，它做的是：

> **告诉模型：你已经进入上下文压力区，后面要更节制。**

也就是说，这一层是“软压缩”。

### 为什么值得做
因为很多对话并不是突然从 30% 跳到 95%，而是会经过一段持续膨胀的阶段。

如果你在 60% 就开始提醒模型：

- 回答更短
- 不要复述已经说过的内容
- 不要整段搬运 tool_result
- 一个子任务做完后，只保留短 checkpoint

那么后面的增长速度会慢很多。

这层的价值在于：

> **hard compact 负责减肥，soft hint 负责别再长胖太快。**

### 一个足够短的 hint
你甚至不需要很复杂，像下面这样就够了：

```text
Context pressure is increasing.
Be concise.
Do not repeat long tool outputs.
Prefer short checkpoints over long restatements.
Only keep details that are necessary for continuing the task.
```

这层 hint 不保证模型一定“自觉 compact”，但它能明显减缓后续膨胀。

---

## 五、90% 的 hard compact：系统必须接管

到了 90%，就不要再依赖模型自觉了，必须系统接管。

### 硬压缩的正确顺序
```text
先 prune
再 re-measure
还不够再 summary
最后 rebuild
```

这 4 步的顺序很重要。

---

## 六、hard compact 内部流程图

```text
[old history + recent tail]
          |
          v
1. deterministic prune
   - delete duplicate readonly tool results
   - shrink large tool_result
   - drop stale low-value payloads
          |
          v
2. re-measure tokens
          |
          +---- enough --------------------> keep working
          |
          +---- still too large -----------> LLM checkpoint summary
                                              |
                                              v
3. rebuild context
   [compact boundary]
   [checkpoint summary]
   [recent tail]
   [runtime state restore if needed]
```

这就是 compact tool 的核心骨架。

---

## 七、什么叫 deterministic prune

这一步不靠 LLM 判断，只靠规则。

目标很简单：

> **先把那些“低风险、可规则化处理”的内容缩掉。**

典型包括：

- 重复的 `read_file / grep / glob / web` 结果
- 超长的 `tool_result`
- 成功但冗长的 bash 日志
- 已经没有继续携带价值的旧载荷

你不用在这一步追求“理解语义”，只要先做到：

- **重复的删掉**
- **过大的截断**
- **噪音正文缩掉，只保留结果语义**

这一步借的是 deepseek 和 Claude Code 的思路：

> 能先便宜减压，就不要一上来动用一次昂贵的 summary。

---

## 八、LLM 压缩真正该产出什么

LLM 压缩不是写一篇摘要文章，而是写一个 **checkpoint**。

这个 checkpoint 最少保留这些字段就够了：

- **Goal**：用户现在要做什么
- **Constraints**：用户有什么要求、限制、偏好
- **Done**：已经完成了什么
- **In Progress**：当前正在做什么
- **Pending**：还没做完什么
- **Key Decisions / Errors**：关键决定、关键报错、为什么这么做
- **Files / Commands / Artifacts**：必须继续引用的路径、命令、产物
- **Next Step**：下一步该干什么

你只要抓住一句话：

> **compact summary 的目标不是“概括过去”，而是“支持继续执行”。**

这就是为什么 pi 的思路很值得借：

- compact 不该被理解成“历史没了”
- 它更像是“旧历史被折叠成一个 checkpoint”

---

## 九、compact 后为什么不能只留 summary

这是很多人第一次设计 compact 时最容易犯的错。

compact 后如果你只留一段 summary，通常会出问题。

因为真正最热的上下文，往往还是最近那几步：

- 最新用户消息
- 最新 assistant 结论
- 最新错误
- 最新 tool_result

所以 compact 后的结构，应该是：

```text
[boundary]
[checkpoint summary]
[recent tail]
```

而不是：

```text
[one big summary only]
```

这里 recent tail 的意义非常简单：

> **summary 负责保留长期状态，tail 负责保留短期工作集。**

---

## 十、overflow recovery：最后一道保险

再好的阈值设计，也不能保证永远不爆窗。

所以 compact tool 最后一定要有一个兜底：

```text
if prompt_too_long:
    run emergency compact
    retry once
```

这部分借 deepseek 的思路最稳：

- 不只是“快满了就压”
- 真爆了也能做一次紧急减压
- 减压成功后继续当前请求

如果没有这层，你的 compact tool 只能算半成品。

---

## 十一、把三家的优点揉成一套自己的方案

如果让我只保留最关键的设计，我会这样组合：

### 借 pi
把 compact 的产物定义成 **checkpoint**，而不是普通摘要。

### 借 deepseek
在每次请求前都量 pressure；先 prune，再 compact；overflow 时 compact + retry。

### 借 Claude Code
不要只有“整段总结”这一条路，而是分层处理：

- hint 软减压
- prune 低成本减载
- summary 正式压缩
- compact 后恢复必要运行态

最后得到的就是一套很清晰的 compact tool：

```text
Measure -> Hint -> Prune -> Summary -> Rebuild -> Retry if needed
```

---

## 十二、如果你只想记住最关键的版本

那就记下面这一版：

```text
< 60%      正常模式
60%~90%    压力模式：塞 hint，让模型少复述、少搬运、少长篇
>= 90%     硬压缩：先 prune，再 summary，再 rebuild
爆窗       紧急 compact + retry
```

而硬压缩内部永远是：

```text
先 prune
再 summary
最后保留 summary + recent tail
```

---

## 十三、toolResultPruner 应该怎么设计

如果说 compact 是“正式压缩”，那 `toolResultPruner` 更像是正式 compact 之前的一次**低成本减压**。

它的目标不是理解整段历史，而是先解决一个最现实的问题：

> **很多上下文，并不是因为用户和 assistant 说了太多，而是因为旧的 `tool_result` 太大、太多、太重复。**

所以 `toolResultPruner` 的职责非常明确：

- **先删重复结果**
- **先缩超长结果**
- **先去掉对继续工作帮助不大的旧载荷**
- **尽量在不调用 LLM 的前提下，把上下文降下来**

换句话说，它不是 summary tool，而是 compact tool 的第一层过滤器。

### 1. 它应该放在整个流程的什么位置

最合理的位置是：

```text
Measure
  -> Soft hint
  -> toolResultPruner
  -> re-measure
  -> if still too large: LLM compact
```

也就是说，`toolResultPruner` 不应该替代 compact，而应该插在 **hard compact 之前**。

原因很简单：

- 它便宜
- 它可控
- 它无损或低损
- 它经常能让你避免一次更贵的 summary

### 2. 它最适合处理什么

最适合处理的，不是 user message，也不是最新的 assistant 决策，而是那些**体积大、可重建、重复率高**的工具输出。

典型就是：

- `read_file`
- `grep`
- `glob`
- `web`
- `bash`
- 各种 blob / 附件 / 长文本读取结果

这些内容有一个共同点：

> **它们常常很占 token，但真正需要长期保留的，通常只是其中一小部分。**

### 3. 它的设计原则

如果只讲关键，我建议你记住 3 条原则：

#### 第一条：删 payload，不删结果语义
你真正该删掉的，往往不是“这次工具执行过”这个事实，而是它返回的那一大段正文。

比如一个很长的 `bash` 输出，真正值得保留的可能只有：

- 执行了什么命令
- 成功还是失败
- 关键错误是什么
- 产物路径是什么

中间那几千行成功日志，通常都可以先拿掉。

#### 第二条：优先处理只读工具结果
最适合 prune 的，是那些可以重新获取的输出。

比如：

- 文件内容可以再读
- 搜索结果可以再跑
- 网页可以再抓
- 成功日志通常不需要永久背着走

这类内容删掉或缩短，风险远小于删除有副作用的结果。

#### 第三条：永远不要破坏“继续工作所需的最小证据”
即使你在 prune，也要保留这些东西：

- tool name
- tool input（路径、命令、查询参数）
- status / exit code
- error signature（如果失败）
- artifact / id / path（如果产出了东西）

所以 pruner 的本质不是“删消息”，而是：

> **把大结果降级成一份更短的、但仍然可继续工作的结果表示。**

### 4. 一个最实用的处理顺序

我建议 `toolResultPruner` 只做 4 类动作，顺序如下：

#### 第一步：删重复结果
先找那些重复的只读结果。

比如：

- 同一个文件被反复 `read_file`
- 同一个 `grep` 查询重复跑了几次
- 同一个 `glob` 结果没有变化
- 同一个网页内容被重复抓取

如果是同一个工具、同一个输入、同一个结果，那么旧结果就可以删，只保留最新一次。

#### 第二步：截断超长结果
如果一个 `tool_result` 特别长，不要立刻整条删掉，而是先做 head/tail 截断。

比如：

- 保留开头一段
- 保留结尾一段
- 中间插入一个 pruned marker

这尤其适合：

- 长文件内容
- 长搜索结果
- 长网页正文
- 长日志

#### 第三步：把长日志降级成“结论 + 证据”
对 `bash` 这类结果，最实用的做法不是简单截断，而是保留：

- command
- exit code
- result: success / failure
- 如果失败，保留 error signature + log tail
- 如果成功，保留关键结论，不保留大段正文

这一步的关键是：

> **失败日志保留错误证据，成功日志保留执行结论。**

#### 第四步：把大对象改成 metadata
如果是 blob、附件、大文档、二进制内容，那最好的做法通常不是保留正文，而是保留：

- 名称
- 类型
- 大小
- 来源
- 引用 ID

正文本身可以先从热上下文里拿掉。

### 5. 哪些内容不要让 pruner 去碰

`toolResultPruner` 虽然是减压工具，但它不能乱删。

最不该碰的是：

- 最近 1~2 步还在使用的 `tool_result`
- 最新失败上下文
- 有副作用的执行结果
- 新生成的 ID、URL、路径、句柄
- 直接决定下一步行为的结果

一句话说就是：

> **pruner 处理的是旧的、重的、可重建的输出，不是当前正在工作的热状态。**

### 6. 你可以把它理解成什么

我觉得最容易理解的比喻是：

- **hint** 是提醒模型别再啰嗦
- **toolResultPruner** 是先把桌面上的废纸收掉
- **LLM compact** 才是正式把旧资料整理成一页交接单

所以在整个 compact tool 里，`toolResultPruner` 的位置非常关键：

它不是主角，但它往往能让真正的 compact 次数下降很多，也能让每次 compact 更轻、更稳。

如果只让我用一句话来总结这一节，那就是：

> **一个好的 toolResultPruner，不负责理解任务本身，它只负责先把那些“又大、又旧、又可重建”的工具输出，从热上下文里安全地减掉。**

---

## 十四、LLM compact 的 checkpoint 提示词应该怎么写

前面的 `hint` 和 `toolResultPruner`，本质上都还不是正式 compact。

真正进入 LLM compact 时，你需要的已经不是“让模型总结一下”，而是：

> **让模型写出一份能交接给下一个模型继续工作的 checkpoint。**

所以 compact prompt 的设计目标，不是“摘要得漂亮”，而是：

- **不要丢状态**
- **不要漏约束**
- **不要忘记下一步**
- **不要把冗长载荷抄回 summary**

如果只讲关键，我建议你把 checkpoint prompt 设计成下面 4 个部分。

### 1. 先明确角色：它不是 assistant，而是 compaction engine

第一句话就要钉死它的身份。

你要告诉模型：

- 你现在不是在继续对话
- 你不是在回答用户问题
- 你不是在给建议
- 你只是在写一份 compact checkpoint

这一步非常重要。

因为如果角色不钉死，模型很容易干错事：

- 开始继续解题
- 开始给用户建议
- 把 summary 写成散文
- 把已经压掉的长日志又抄一遍

所以 prompt 的开头最好像这样：

```text
You are acting as a compaction engine for an AI assistant.
Do not continue the conversation.
Do not answer the user.
Output only a structured checkpoint for future continuation.
```

### 2. 再明确目标：不是回顾历史，而是支持继续执行

这里你要告诉模型，compact 的目标不是“总结上文”，而是：

> **让下一个模型在只看到 checkpoint + recent tail 的情况下，还能继续准确工作。**

这句话很关键，因为它会直接影响模型保留什么、丢什么。

一旦它理解成“写摘要”，就会倾向于：

- 讲很多背景
- 复述过程
- 写得很顺
- 但漏掉真正关键的运行态信息

而你真正要它保留的，是：

- 用户当前目标
- 用户约束
- 已完成步骤
- 未完成工作
- 当前正在进行的事情
- 关键错误与关键决定
- 路径、命令、参数、ID、产物
- 下一步要干什么

### 3. 强制固定结构，不要让模型自由发挥

checkpoint prompt 最重要的一点，就是必须给固定结构。

如果不规定结构，模型输出通常会越来越散。

我建议最少保留这几个 section：

- `Goal`
- `Constraints`
- `Done`
- `In Progress`
- `Pending`
- `Key Decisions / Errors`
- `Files / Commands / Artifacts`
- `Next Step`
- `Critical Context`

你会发现，这套结构其实回答的就是几个最核心的问题：

- 现在要做什么
- 有什么限制
- 已经做到了哪
- 接下来该干什么
- 哪些信息不能丢

如果只想保留最小版本，这一套已经够用了。

### 4. 明确告诉模型：哪些必须保留，哪些不要抄

这是 compact prompt 最容易被忽视的一步。

你需要显式告诉模型：

#### 必须保留
- 用户当前目标及其变化
- 用户约束、偏好、禁止项
- 已完成的关键工作
- 尚未完成的请求
- 当前正在处理的问题
- 关键错误、根因、修复状态
- 精确的文件路径、命令、函数名、错误字符串、参数、ID、配置值
- 下一个模型继续工作必须知道的信息

#### 不要保留
- 冗长工具原始输出
- 重复结果
- 大段成功日志
- 已经过时的中间推理
- 无关寒暄
- 对继续工作没有帮助的细节

这里要特别强调一句：

> **不要把已经 prune 掉的大载荷，又重新写回 compact summary。**

否则前面的 `toolResultPruner` 就白做了。

### 一个可以直接用的 checkpoint prompt 模板

如果你想要一版最简可用模板，我建议直接用这种：

```text
You are acting as a compaction engine for an AI assistant.

Condense the conversation above into a structured checkpoint that allows another model to continue the work with no loss of essential context.

Rules:
- Do NOT continue the conversation.
- Do NOT answer the user.
- Do NOT call tools.
- Output ONLY the checkpoint.
- Use concise engineering language and bullet points, not prose paragraphs.
- Preserve exact file paths, function names, commands, error strings, identifiers, numeric values, URLs, and configuration values when they matter.
- Keep still-true facts, remove stale ones, and merge newer information into a single consistent checkpoint.
- Exclude long raw tool outputs, repeated results, stale intermediate reasoning, and details that do not help future execution.

Use this EXACT format:

## Goal
- [current user goal(s)]

## Constraints
- [constraints, preferences, prohibitions]

## Done
- [completed work]

## In Progress
- [current active work]

## Pending
- [unfinished requested work]

## Key Decisions / Errors
- [decision, rationale, errors, fix status]

## Files / Commands / Artifacts
- [exact paths, commands, IDs, outputs, artifacts]

## Next Step
- [single most immediate next action]

## Critical Context
- [anything required to continue correctly]
```

### 这套 prompt 和前两层是什么关系

你可以把三层关系理解成：

- **hint**：让模型之后别长太快
- **toolResultPruner**：把旧的、大的、重复的工具结果先缩掉
- **checkpoint prompt**：把真正还要长期保留的状态，整理成结构化交接单

所以 checkpoint prompt 不应该单独看。

它真正有效，是因为在它之前：

- 低价值 payload 已经被 prune 过
- recent tail 已经被保护住了
- 现在轮到 LLM 去整理“剩下那部分高价值历史”

这也是为什么一个好的 compact tool，不是只有一个 prompt，而是一个分层流程。

### 如果只用一句话总结这一节

那就是：

> **LLM compact 的提示词，不是让模型写摘要，而是让模型写一份“下一个模型可以直接接班”的 checkpoint。**

---

## 十五、一个最小可用 compact tool 的完整流程图

如果前面几节你都看懂了，那最后其实可以收束成一张完整图。

你可以把一个 compact tool 理解成：

> **一个在不同压力区间下，逐级升级处理手段的上下文管理流程。**

最小可用版本，不需要太多花哨设计，只要把下面这张流程图跑通，compact 基本就成立了。

### 完整主流程图

```text
[Before next model request]
          |
          v
1. Measure context usage
   - current_tokens
   - context_window
   - usage_ratio
          |
          +---- < 60% ----------------------------------> Normal mode
          |                                                - no compact
          |                                                - continue request
          |
          +---- 60% ~ 90% -------------------------------> Soft pressure mode
          |                                                - inject hint
          |                                                - ask model to be concise
          |                                                - avoid repeating tool outputs
          |                                                - continue request
          |
          +---- >= 90% ----------------------------------> Hard compact mode
                                                           |
                                                           v
2. Protect recent tail
   - latest user goal
   - latest assistant conclusion
   - latest unresolved error
   - latest active tool result(s)
                                                           |
                                                           v
3. Run toolResultPruner
   - delete duplicate readonly results
   - shrink oversized tool_result
   - compress long success logs
   - keep error signature for failures
                                                           |
                                                           v
4. Re-measure tokens
                                                           |
                                                           +---- below threshold -------> Rebuild light context
                                                           |                               [old history after prune]
                                                           |                               [recent tail]
                                                           |                               continue request
                                                           |
                                                           +---- still too large -------> LLM checkpoint compact
                                                                                           |
                                                                                           v
5. Generate checkpoint summary
   - Goal
   - Constraints
   - Done / In Progress / Pending
   - Key Decisions / Errors
   - Files / Commands / Artifacts
   - Next Step
   - Critical Context
                                                                                           |
                                                                                           v
6. Rebuild active context
   [compact boundary]
   [checkpoint summary]
   [recent tail]
   [runtime state restore if needed]
                                                                                           |
                                                                                           v
7. Continue request
```

这张图里最重要的是一条主线：

```text
Measure -> Hint -> Protect Tail -> Prune -> Re-measure -> Summary -> Rebuild -> Continue
```

只要这条主线成立，你的 compact tool 就已经不是“一个 prompt”，而是一套完整机制了。

### 为什么这个顺序不能乱

这套顺序其实对应的是一条很朴素的原则：

> **先用最便宜的方法减压，实在不够，再动用最贵的摘要压缩。**

所以顺序必须是：

1. **先量**：先知道是否真的有压力
2. **先 hint**：先减缓未来膨胀速度
3. **先保 tail**：先把热工作集锁住
4. **先 prune**：先把低价值大载荷拿掉
5. **再 summary**：最后才让 LLM 压旧历史
6. **再 rebuild**：重建成一个新的可继续工作上下文

如果把顺序反过来，比如一上来就 summary，通常会有两个问题：

- 成本更高
- 很容易把本来可以确定性处理的 tool payload 也交给 LLM，导致 summary 又长、又不稳

### overflow 时的兜底流程图

除了主流程外，你还应该有一条兜底支线。

```text
[Model request]
      |
      v
prompt-too-long / context-overflow ?
      |
      +---- no  ----> normal response flow
      |
      +---- yes ---> Emergency compact
                      1) preserve latest tail
                      2) run more aggressive prune
                      3) if needed, force checkpoint summary
                      4) rebuild context
                      5) retry once
```

这条支线的意义非常简单：

> **正常 compact 负责预防，emergency compact 负责抢救。**

没有这条支线，compact 只能算“平时能用”；有了它，才算“真的能兜底”。

### 如果你想把整套方案记成一句话

那我建议你记这个版本：

```text
60% 之前正常工作；
60% 之后先 hint；
90% 之后先 prune，再 summary；
真爆窗就 compact + retry。
```

或者再压缩一点：

> **平时靠 hint 减速，快满时靠 prune 减载，实在不够就靠 checkpoint summary 折叠旧历史。**

这其实就是一个最小可用 compact tool 的完整心智模型。

---

## 结语

如果把 compact 只看成一个 prompt 技巧，你会很容易把它设计成“快满了就让 LLM 总结一下”。

但真正好用的 compact tool，更像一个分层的上下文管理系统。

它要同时处理四件事：

- **何时提醒**：60% hint
- **何时接管**：90% hard compact
- **怎么减载**：先 prune，再 summary
- **怎么兜底**：overflow 后 retry

所以 compact 的本质不是“写摘要”，而是：

> **在有限上下文预算内，维持一个能持续工作的活跃工作集。**
