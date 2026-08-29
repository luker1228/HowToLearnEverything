---
title: 从 Prompt 到 Function Call 到 MCP(上):模型怎么一步步学会"动手"
date: 2026-08-29
tags:
  - agent
  - function-calling
  - mcp
  - blog
---

# 从 Prompt 到 Function Call 到 MCP(上):模型怎么一步步学会"动手"

## 先别急着讲知识,几个问题摆在桌上

在讲任何概念之前,先把问题想清楚——因为技术这东西,从来不是"因为炫酷所以发明",而是"因为卡住了所以必须发明"。

- 大模型能写诗、能推理、能聊哲学,为什么连"现在几点"都答不上来?为什么不能就用一句 prompt 说"你可以调用工具",让模型自己去查?
- 2023 年 OpenAI 搞出 function calling 之前,大家是怎么让模型"干活"的?那套办法为什么不够用?
- Function calling 出来之后,是不是所有"模型连外部世界"的问题就都解决了?
- 如果 function calling 已经能让模型调用任意函数,那 2024 年底又冒出来的 MCP,是在解决什么新问题?是不是只是把"客户端的活"挪到了"服务端"?
- 假设现在要你从零设计一套"模型接入外部系统"的协议,你会先想清楚哪几件事?协议本身用什么格式传消息,谁来发现有哪些工具,风险操作怎么办?

这篇文章不会一上来告诉你答案,而是顺着这几个问题,把 function call 和 MCP 从"为什么需要"讲到"长什么样"。全文只有一条主线:**技术的每一次演进,都是因为上一层解决不了新问题了**。没有 function call 之前,模型只能是个聊天工具,它想"动手"却没有手;没有 MCP 之前,每接入一个新工具、每换一个 Agent 项目,都要重新写一遍胶水代码,工作量随着"应用数 × 工具数"爆炸式增长。

---

## 一、模型到底是什么:一台只会接话的机器

先回到最原始的问题:原始的大模型,为什么天生不会"调用工具"?

不是因为产品经理没给它加这个功能,而是机制上它就没有手。大模型本质上是一个条件概率模型——给定前面的 token,预测下一个 token 是什么:

$$
P(x_{t+1} \mid x_1, x_2, \ldots, x_t)
$$

它的输出永远是词表里的一个编号,不是一次系统调用。它没有网卡,没有文件系统,没有时钟,没有数据库连接;它的参数是训练时刻的静态快照。哪怕它写出 `open("/tmp/a.txt")` 这样的字符串,那也只是字符串——本地跑过模型的人都遇到过这种翻车:模型信心满满地说"文件已经写好了",目录里什么都没有。

更进一步说,原始模型甚至没被**训练成**"该出手时就发出一次可执行调用"。预训练的目标是续写网页、书籍、对话,数据里几乎没有"这里应该停下来,吐一个符合某个 schema 的调用"这种模式。所以它退而求其次,做它最擅长的事:凭记忆编一个天气数字、用一句"我去帮你查一下"敷衍过去、或者把伪代码原样打印在回复里给你看。

所以第一个问题的答案是:**模型不是不愿意干活,是它压根没有"手",也没被教过什么时候该伸手**。这决定了后面所有设计的起点——执行永远得在模型外面找一个东西来做。

---

## 二、没有 function call 之前,大家怎么"骗"模型动手

模型没有手,但工程师们等不起,总得先想办法用起来。核心思路就一个:模型只会吐文字,那就在 prompt 里手写规则,规定它按某种格式把"要调用的工具"写出来,再用正则从这段文字里抠出函数名和参数——业内管这个套路叫 **prompt and pray**。LangChain 早期的 `ZERO_SHOT_REACT_DESCRIPTION` 就是这条路子:

```text
Thought: ...
Action: get_weather
Action Input: Boston
```

这套东西的调用成功率很低,而且低得没什么办法根治,原因就在"正则识别"这一步本身:模型输出的是自然语言,而自然语言从定义上就是不精确、可以有无数种等价表达的。模型可能在 JSON 外面多套一句解释,工具名少写一个下划线,把 `Action Input:` 打成 `Input:`,或者用户一句话("顺便帮我...")就把它精心维持的格式冲垮。正则表达式只能匹配"预期内"的形状,只要模型的输出偏离哪怕一个字符,解析就直接失败,整轮对话要么报错要么重试。这不是哪次 prompt 没写好能修复的问题,而是"用一套硬规则,去猜一个软输出"这个组合天生就不稳定——谁写过这类 Agent,都懂那种"薛定谔的调用成功率"。

这条路走到产品层面,就是 ChatGPT Plugins(2023.3):用 OpenAPI 描述第三方 API,让模型去调用,这已经很接近后来的 function calling 了,但它本质是一个产品级的插件市场,不是通用的 API 调用能力——发现难、质量参差不齐、安全模型也不成熟,2024 年 4 月就关停了,迁去了 GPTs / Actions。OpenAI 自己在后来的 function calling 公告里承认:他们是从 Plugins alpha 里学到了怎么让工具和语言模型安全协作的。

时间线拉出来看会更清楚这是怎么一步步逼近的:

```text
2022 前     补全/聊天,纯文本
2022.10     ReAct:prompt 约定 Thought/Action
2023.02     Toolformer
2023.03     ChatGPT Plugins
2023.06     OpenAI Function Calling(gpt-4-0613 / gpt-3.5-turbo-0613)
2023.11     tools 取代 functions;支持并行调用;JSON mode
2024.05     Anthropic tool use 正式开放
2024.11     MCP 开源
```

所以,function calling 出现之前,大家不是完全没法"用工具",而是协议是**软的**:靠 prompt 的字面约定,靠正则去猜模型到底想干什么。这套东西能跑,但可靠性天花板很低。

---

## 三、Function Call 到底解决了什么问题

那 2023 年 6 月这次改动,到底改了什么?

一句话:**它把"说话"和"提出调用"这两件事,从同一个文本流里拆成了两条通道。**

在这之前,模型无论想不想动手,输出的都是同一坛子文字,你只能靠猜。有了 function calling(现在更常叫 tool calling)之后,模型的响应里出现了一个独立的、结构化的字段:

```json
{
  "name": "get_weather",
  "arguments": { "city": "北京" }
}
```

`content` 是给人看的话,`tool_calls`(或早期的 `function_call`)是给程序读的结构化调用。运行时一看到这个字段,就知道"这轮不是在闲聊,是要办事了",直接把结构化参数交给真正的函数去执行,再把执行结果作为一条 `tool` 消息塞回对话,模型接着往下说或者接着调下一个工具。

这里有个比喻很好用:**模型是一个会说话、但没有手的实习生**。function call 是它学会写的那份结构化调用——写清楚要调哪个函数、需要哪些参数——但调用本身不是手,真正伸手去干活的是拿到这份调用的那个人(Agent / 运行时)。

需要收窄两个常见的说法误区:

- 模型并不是"主动把活交给" Agent。它本质上还是在一个 token 一个 token地生成;是运行时判断"这次输出落在 `tool_calls` 而不是普通 `content` 里",才决定去执行。
- 真正执行的是宿主里的那套循环,常被称为 agent loop。"Agent" 指的是整套系统,不是模型本人。

对照一下,这次改动到底比 ReAct 硬在哪:

| | ReAct / prompt 时代 | Native function calling(2023.6 起) |
|---|---|---|
| 工具怎么告诉模型 | 写在 prompt 文字里 | JSON Schema,作为 API 的正式参数 |
| 模型怎么表示"要动手" | 混在 `content` 里 | 独立字段 `tool_calls` |
| 可靠性 | 提示词 + 解析器 + 重试 | 专门为这件事微调过的模型 + schema 约束 |
| 谁来解析 | 正则抠文本 | 程序直接读结构化字段 |

一句可以直接带走的总结:**模型负责提出调用,Agent 负责办事,办事的结果再变成下一轮输入**。

---

## 四、这个"提出调用"的能力,是怎么教出来的

这里要纠正一个常见的直觉:function calling 不是 Transformer 架构自带的能力,也不是预训练"顺便"长出来的,它是**后训练专门教出来的一种说话方式**。

OpenAI 的原话是:模型被 fine-tune 过,去判断"要不要调函数",并吐出贴合函数签名的 JSON。训练配方没有完全公开,但公开的论文和开源训练流程,已经把主路径讲得很清楚了。训练样本大致长这样:

```text
输入:
  tools = [get_weather 的 JSON Schema, ...]
  user  = "旧金山现在多少度?"

目标输出(assistant):
  tool_calls = [{
    "name": "get_weather",
    "arguments": {"location": "San Francisco"}
  }]

然后:
  tool 角色:{"temp": 18}
  assistant:旧金山现在大约 18°C。
```

SFT 阶段就是普通的 next-token 交叉熵,只是训练目标从"写一段回答"换成了"先写出这段结构化调用"。有一个细节特别关键:**用户消息和 tool 返回值要 mask 掉、不计入 loss**,否则模型学的就是"怎么扮演环境",而不是"怎么正确调用"。

数据几乎全是合成轨迹,因为人工标注太贵:Toolformer 用自监督在语料里插调用,真的执行、只保留有助于预测后文的样本;Gorilla、ToolLLM 这类工作靠成千上万个真实 API 生成调用轨迹;Llama 3 的技术报告里专门提到,他们刻意练了 **zero-shot function calling**——推理时给一套训练时没见过的工具定义,模型依然要能按 schema 填对参数。这意味着你可以临时塞一个新工具进去,不用为每个 API 单独训一次模型。

之后再叠 DPO(用"该调却直接编答案""调了不存在的工具""参数类型错"这类坏轨迹去纠偏该调不该调、调哪个)和带环境的强化学习(整条多步轨迹滚下去,最后看任务有没有真正办成)。

一条链路总结:

```text
预训练:会说话
    ↓
SFT 工具轨迹:会按 schema 写出调用
    ↓
DPO / RL:更会判断何时调、多步是否成功
    ↓
推理:chat template +(可选)语法约束解码
    ↓
运行时:真正执行,结果再喂回去
```

推理时还有两个"外挂":每次请求都要把当前的 tools schema 塞进上下文——模型没把你的业务函数记进权重里,它学的是"看见 schema 就照着填";很多系统还会用约束解码(如 `strict` 模式)去兜底格式,这是推理层的保险,不是训练本身。

也正因为这是"教出来的行为"而不是"推理出来的判断",function calling 有一条硬伤:**schema 合法,不等于事情做对**。用户说"先别创建,给我看个示例",模型仍然有可能输出 `{"action":"create"}`。权限校验、危险操作确认、审计,这些都还留在执行层,不是靠训练模型"更懂事"就能兜底的。

---

## 五、有了 function call,新的麻烦浮出水面

到这里,似乎故事该讲完了:模型会提出调用了,Agent 会执行了,一切完美。

但真正做过 Agent 的人会发现一个现实问题:function calling 从来没有真正"连上别的应用"。它只是让模型能够向**当前这一个程序**发出一次结构化调用。想连 GitHub、连 Slack、连数据库,靠的是运行时接到这次调用之后、你在这个程序里**手写的胶水代码**:

```text
模型 --function call--> 你的 Agent
                          ├── 手写 get_github_issue()  → GitHub API
                          ├── 手写 send_slack()        → Slack API
                          └── 手写 query_db()          → 数据库
```

Function calling 在这里,是**当时唯一能用的原语**,而不是一个为跨应用集成专门设计的方案。这就像 USB 出现之前,什么外设都是直接焊在主板上的——能用,但你每换一台电脑,就得重新焊一次。

问题的规模到底有多大?假设有 M 个 AI 应用(Cursor、Claude Desktop、你自己写的 Agent……),每个都想连 N 个外部系统(GitHub、Slack、公司内部数据库、某个小众 SaaS……)。如果每一对"应用 × 工具"都要手写一遍胶水,工作量就是 **M × N**——这就是后来常说的 **N×M 问题**,灵感直接来自 IDE 领域早年遇到的同一类麻烦:每个 IDE 想支持每种语言的智能提示,都要重新写一遍,直到 Language Server Protocol(LSP)出现,把这件事拆成"一个语言服务器,任意 IDE 都能接"。

Anthropic 在 2024 年 11 月 25 日发布 MCP 时说的原话就是这个意思:每接一个新数据源,都要自己做一套对接,真正连起来的系统很难规模化。

所以第五个问题的答案是:**function calling 解决了"模型如何可靠地表达意图",但没有解决"同一个能力怎么在不同应用之间复用"**。这是下一层要解决的新问题。

---

## 六、MCP 想解决的,是 M×N,不是"把客户端搬到服务端"

一个很容易产生但需要纠正的直觉是:"function call 相当于在客户端搞,MCP 就是把这活儿挪到服务端"。这个方向感是对的——MCP 确实让"小众服务不用被每个客户端各自包一层 tool"——但分层理解差了一点。

更准确的说法是:MCP 解决的是**发现和复用**,不是把调用这件事从一端搬到另一端。用一张图把三层钉死,后面所有讨论都不要偏离这张图:

```text
模型  --function / tool call-->  宿主 (Agent runtime)
                                   --MCP tools/call-->  MCP Server
                                                        --真正干活--> GitHub / DB / 本地文件
```

| 层 | 谁跟谁说话 | 解决什么 | 没有它时 |
|---|---|---|---|
| Function / tool calling | 模型 ↔ 当前这个运行时 | 模型如何稳定提出"调用" | prompt 约定格式 + 正则抠文本 |
| 手写 glue / OpenAPI | 运行时 ↔ 某个 HTTP 服务 | 这一次怎么调通一个 API | 每个客户端自己包一层 tool |
| MCP | 运行时 ↔ 可复用的工具进程 | 发现、插拔、跨宿主复用 | 每个 AI 应用把同一套 tool 各写一遍 |

有了 MCP 之后,前面那张"手写胶水"的图并没有消失,只是后半段被标准化了:

```text
模型 --function call--> 宿主 --MCP tools/call--> GitHub MCP Server → GitHub
```

变的是:胶水从"每个应用里散落的 tool 函数",变成了"任何宿主都能接上的、可发现的标准 server"。GitHub 官方发一个 MCP server,Cursor、Claude Desktop、你自己写的 Agent 只要配置好连接,就能通过 `tools/list` 发现它有哪些能力,通过 `tools/call` 去调用——这一层**写一次,各家复用**。

这里也要纠正两个常见的过度引申:

- **MCP server 不一定在云上。** 最早一批 MCP server 就是本机 `stdio` 进程,比如 Claude Desktop 直接把一个本地程序拉起来当子进程用。本地文件系统、本机浏览器、本机数据库,全都是合法的 MCP server。把 MCP 理解成"服务端的事",会漏掉本地场景这一半。
- **Tool call 没有被 MCP 取代。** 宿主发现到 MCP 工具之后,依然要把工具的 schema 交给模型,走一遍普通的 function calling。模型该怎么决定调不调、调哪个,MCP 完全不管——那还是上一层的事。

也顺便说清楚 MCP 和 OpenAPI 的关系,免得写成互斥:OpenAPI 描述的是任意 HTTP 客户端都能调的、无状态的 REST 接口;MCP 关心的是 AI 宿主怎么**发现**、怎么**会话式地调用**、怎么**带着上下文**连上某个能力。很多 MCP server 内部其实就是包了一层 OpenAPI/REST,再在外面补上 resources、prompts 和会话状态——两者不是替代关系,是不同层。

| | OpenAPI | Function calling | MCP |
|---|---|---|---|
| 合同 | 无状态 HTTP | 这一次 LLM 请求里的函数清单 | 运行时总线(JSON-RPC) |
| 发现 | spec 文件,偏静态 | 每次请求静态塞进 tools | `tools/list`,支持变更通知 |
| 为谁设计 | 任何人 / 服务 | 单个应用内的模型 | AI 宿主 ↔ 工具提供方 |

那什么时候还是老老实实手写 function calling 就够,不必上 MCP?一个应用内部、就那么几个动作、要求低延迟、逻辑本来就在自己进程里——继续手写就好。真正该上 MCP 的场景是:要跨宿主复用、要给别人的 Agent 接入、工具会持续变化、要连本地资源。**MCP 不替代 function call,两者是叠着用的关系。**

---

## 七、MCP 到底是什么:拆开它的核心内容

前面一直在讲"为什么",现在可以正式定义了。

MCP(Model Context Protocol)是 Anthropic 于 2024 年 11 月 25 日开源的开放标准,给 AI 应用(宿主)和外部系统之间,规定了一套**如何交换上下文、如何发现并调用能力**的协议。官方自己划过边界:

> MCP 只管上下文交换协议,不管 AI 应用怎么用 LLM、怎么管理这些上下文。

常说的 USB-C 比喻,以及"MCP 抄了 LSP 的设计思路"的说法,指的都是同一件事:写一次 server,任何遵循协议的宿主都能接。

**三个角色,先分清楚谁是谁**

| 角色 | 是什么 | 例子 |
|---|---|---|
| **Host** | AI 应用,创建并管理多个 client,负责权限和用户确认 | Claude Desktop、Cursor、你自研的 Agent |
| **Client** | Host 内部、一对一连某个 server 的连接器 | VS Code 连 Sentry 时实例化的那个连接对象 |
| **Server** | 提供上下文和能力的程序,本地或远程都行 | 本机 filesystem、远程 Sentry MCP |

这里必须强调一句容易被读错的话:**Host 是 AI 应用,不是 LLM 本身**。模型只是 Host 内部调用的大脑。模型也**不会**直接调用 MCP Server,更没有什么特殊的"MCP function call"——它调用工具时用的还是普通的 `tool_calls`。真实的路径是:Host 把 MCP 的 `tools/list` 结果转换成这次请求里的 `tools` 数组交给模型;模型写出这次调用后,Host 再查表,把它转发成 JSON-RPC 的 `tools/call` 发给对应的 MCP Server。

```text
模型  --tool_calls-->  Host  --tools/call-->  MCP Server
       function calling         JSON-RPC
```

对模型来说,Host 内置的 `Read` 工具和来自某个 MCP server 的 `create_issue` 长得完全一样——有些产品会给名字加前缀(比如 `mcp_github_create_issue`)方便 Host 内部路由,但那只是命名约定,不是新协议。

**两层结构:数据层 + 传输层**

数据层用 JSON-RPC 2.0,定义消息长什么样、有哪些方法(发现、tools/resources/prompts、各种通知),所有传输方式共用这一套消息格式。传输层则是消息怎么运:

| 传输 | 怎么连 | 适合 |
|---|---|---|
| **stdio** | Host 把 server 当子进程拉起,stdin/stdout 换行分隔 JSON-RPC | 本机工具、文件、个人配置 |
| **Streamable HTTP** | 一个 HTTP 端点,客户端 POST,响应可以是 JSON 或该请求范围内的 SSE | 远程、多客户端、OAuth |

**核心原语:Server 能暴露三样东西**

这是理解 MCP"到底提供了什么"最关键的一块:

| 原语 | 给谁用 | 干什么 | 典型方法 |
|---|---|---|---|
| **Tools** | 模型(经宿主) | 可执行动作:读文件、调 API、查库 | `tools/list` → `tools/call` |
| **Resources** | 应用 / 模型当上下文 | 只读数据:文件内容、表结构、API 响应 | `resources/list` → `resources/read` |
| **Prompts** | 用户 / 应用 | 可复用的交互模板:系统提示、few-shot | `prompts/list` → `prompts/get` |

Tools 是**模型控制**的——模型根据用户意图决定调不调;Resources 和 Prompts 更像是应用侧主动塞进来的上下文,不一定每轮都进模型。比如一个数据库 MCP,典型拆法是:Tool 是 `query_sql`,Resource 是数据库 schema,Prompt 是一份"怎么问这套库"的 few-shot 模板。

一次典型交互大致是:先发现(交换协议版本和 capabilities),再列工具(`tools/list` 拿到 name + inputSchema),再调用(`tools/call` 传入 `{name, arguments}`,server 执行后返回 content),可选地订阅工具列表变更通知。**这不是全网搜索式的发现**,只是发现已经配好连接的那几个 server——server 加了新工具,客户端代码不用改,下次 `list` 就能看到。

---

## 八、如果让你设计一个 MCP,要想清楚哪几件事

回到开篇的最后一个问题:假如从零设计这套协议,该想清楚哪几个决策点?顺着 MCP 实际的设计,可以看到几个关键考量。

### 1. 用什么格式传消息:为什么是 JSON-RPC 2.0,不是 protobuf

一个常见的直觉是:"方便 Agent 调用,如果换成二进制协议比如 protobuf,Agent 应该写不出来吧。" 这个直觉其实落错了层——**模型通常根本不写 JSON-RPC**。Host 里的 MCP Client 才写 JSON-RPC;模型写的是 function call 那部分(`name` + `arguments` 的 JSON)。换成 protobuf,Agent 照样能调工具,只要宿主会编解码就行。

真正的选型理由,是 MCP 明确抄了 LSP 的做法:JSON-RPC + 双向通信,把"无聊但可靠"的部分定下来,创新精力都放在 Tools / Resources / Prompts 这些原语设计上。具体优势有几条:

1. **传输无关**:同一套消息能跑在 stdio、HTTP、任意自定义通道上。gRPC 绑死了 HTTP/2,塞不进"拉起一个本地脚本、靠 stdin/stdout 说话"这种场景。
2. **天然双向**:任何一方都能发 Request。MCP 需要 server 反过来向用户提问(下一节讲的 elicitation),而 REST 默认是单向的。
3. **三种消息形态刚好够用**:Request / Response / Notification。Notification 用来推送"工具列表变了",不需要每次都等回包。
4. **零代码生成**:每种语言天生都会处理 JSON,十行 Python 就能 `print` 出一个 server;protobuf 得先写 `.proto`,再跑 `protoc` 生成 stub。
5. **动态 schema**:工具列表是运行时可变的,而 protobuf 更偏编译期合同。MCP 的工具合同就活在 `tools/list` 返回的 JSON Schema 里。

社区确实公开讨论过"为什么不用 protobuf/gRPC",官方回应的方向是:能用,尤其在远程高性能场景下;但和"stdio 优先、零门槛接入、工具动态可变"这批设计目标不太合拍。后续也有提案把 payload 从 JSON-RPC 方法定义里解耦出来,方便将来兼容 gRPC——但线上协议目前还是 JSON-RPC。

分层看会更清楚,protobuf 卡住的从来不是"模型写不出二进制",而是中间那层实现门槛:

```text
模型   →  function call JSON(模型会写,训练时就是这么教的)
宿主   →  JSON-RPC(宿主写,模型通常看不见)
server →  真去调 GitHub / 读文件
```

### 2. 危险操作怎么办:Elicitation 问的是人,不是模型

MCP Server 本身通常没有 LLM,它只是一段普通代码。那它怎么"知道"该在删除文件前弹一个确认框?答案很朴素:**就是写死的一个 `if`**。当 tool 执行到一半、需要人补充信息或者确认风险操作时,server 发一个 `elicitation/create` 请求给 Host,Host 弹一个表单(或打开一个 URL)让人来填,拿到答案后 server 再把剩下的活干完。

这里要把两种"再问一次"分清楚,很容易混:

| | 谁被问 | 像什么 |
|---|---|---|
| tool 参数报错回灌 | 模型 | Agent 循环,模型改调用再发一次 |
| Elicitation | 人 | Host 弹窗 / 打开确认页面 |

一个订桌的例子能说明白这套流程:用户说"订 12 月 25 日 19 点、4 人桌"。模型发出的调用 `book_table({party_size: 4, date: "2024-12-25", time: "19:00"})` 参数完全合法,不是解析错误。Host 把这个调用转发给 server,server 一查——圣诞节没空桌了,这是业务上订不了,不是参数错。于是 server 发出:

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "12月25日没有4人桌。请另选一个日期。",
    "requestedSchema": {
      "type": "object",
      "properties": { "alternate_date": { "type": "string" } },
      "required": ["alternate_date"]
    }
  }
}
```

Host 弹出表单,人填了 `2024-12-26`,Host 把这个答案回给 server,server 才真正下单——模型全程只看到最后的结果"已订 12 月 26 日",看不见中间那次弹窗。删除确认之类的敏感操作,走的是同一套机制,只是 `requestedSchema` 换成一个 `confirm: boolean`。

**权限和确认的裁决权在 Host,不在模型,也不该在 MCP server 里偷偷做完就算了。**

### 3. 给存量服务接 MCP,外壳该怎么切

最后一个设计问题很实际:公司里已经有一个订单服务,创建、查询、修改、下单四个 REST 接口,现在想让 Agent 也能用,是不是把这四个接口原样包成四个 MCP tool 就行了?

答案是:外壳的方向对了一半。**MCP 是面向 Agent 的适配层,不是 REST 换个皮**。存量的 HTTP 接口继续留给前端和其他后端用;MCP Server 站在旁边,调的是同一套后端服务。真正要变的是设计单位:工具要按"Agent 想完成什么"来切,不能按 `GET/POST/PATCH` 一一对应地摊平。

原因很直接:REST 是给程序员组合小接口用的,程序员可以在一次请求里灵活拼装;但 Agent 每调一次工具都要经过一轮模型推理,接口切得太碎,不但贵,还容易被模型选错、编排错。

对着四个存量接口重新设计一遍:

| 存量接口 | 直接 1:1 摊平的坑 | 更好的做法 |
|---|---|---|
| 创建订单 | 和"下单"这个意图容易分不清 | 收到"下单"请求后,在 server 内部先建草稿 |
| 查询订单 | 返回字段太大,容易撑爆上下文 | `get_order` 只留 id / 状态 / 金额 / 地址 / 商品 |
| 修改订单 | 字段一多,模型乱填 | `update_order` 用白名单字段 |
| 下单 | 模型自己拍板,直接下真实订单 | 一个 `place_order`,内部创建 + 提交,危险操作走 elicitation 确认 |

最小可用版本大概三个 tool 就够。一个薄适配器长这样:

```python
import os, httpx
from fastmcp import FastMCP, Context

mcp = FastMCP("order-service")
API = os.environ["ORDER_API_BASE"]
TOKEN = os.environ["ORDER_API_TOKEN"]

def client() -> httpx.Client:
    return httpx.Client(
        base_url=API,
        headers={"Authorization": f"Bearer {TOKEN}"},
        timeout=15,
    )

@mcp.tool
def get_order(order_id: str) -> dict:
    """查询订单状态、金额、收货信息。用户问某笔订单进度时用。"""
    r = client().get(f"/orders/{order_id}")
    r.raise_for_status()
    o = r.json()
    return {
        "id": o["id"], "status": o["status"], "amount": o["amount"],
        "address": o.get("address"), "items": o.get("items"),
    }

@mcp.tool
async def place_order(
    ctx: Context, sku: str, quantity: int, address: str, order_id: str | None = None,
) -> str:
    """创建并提交订单。真实下单,必须等人确认后再执行。"""
    elicit = await ctx.elicit(
        message=f"即将下单:{sku} x {quantity},送到 {address}。确认提交吗?",
        requestedSchema={
            "type": "object",
            "properties": {"confirm": {"type": "boolean"}},
            "required": ["confirm"],
        },
    )
    if elicit.action != "accept" or not elicit.data.get("confirm"):
        return "用户取消下单"

    with client() as c:
        if not order_id:
            created = c.post("/orders", json={"sku": sku, "quantity": quantity, "address": address})
            created.raise_for_status()
            order_id = created.json()["id"]
        placed = c.post(f"/orders/{order_id}/place")
        placed.raise_for_status()
    return f"已下单 {order_id}"
```

模型只看得见 `get_order`、`update_order`、`place_order` 三个 function,两次真正的 REST 调用发生在 server 内部,模型和用户都不需要关心。

设计清单可以总结成几条:存量服务尽量零改造,只在 MCP 层裁剪字段;工具数量控制在 3~7 个,不要把 40 个 `GET` 全暴露出去;`description` 要写清楚"何时用 / 何时不要用";写操作只返回 `{id, status}`,不要整单 dump 回去;错误信息用人话表达、并指出可修改的字段;凭证留在 MCP 进程的环境变量里,永远不要进 tool 的 schema。**外壳的本质,是面向 Agent 的门面,不是 REST 的透明代理。**

---

## 收个尾:这条主线到底在说什么

拉回到开篇的问题,现在可以把答案串起来看:

模型天生只会吐 token,没有手,所以在 function calling 出现之前,它只能是个聊天工具——想让它"干活",全靠 prompt 里的软约定和正则表达式硬猜。Function calling 把"说话"和"提出调用"拆成两条通道,让模型学会了稳定地写出一次结构化调用,但这解决的只是"模型 ↔ 当前这个程序"之间的沟通问题;真正连上 GitHub、Slack、数据库的胶水代码,还是要在每个应用里手写一遍。等应用多了、工具多了,M 个应用乘 N 个工具的胶水代码就成了谁都写不起的重复劳动——这是 MCP 出手解决的问题:把"发现和调用工具"这一层协议标准化,写一次 server,所有遵循协议的宿主都能接上。

三层因此钉在一起,谁也没有取代谁:模型负责提出调用,Agent(宿主)负责执行和把关,MCP 负责让工具可以插拔复用。

这篇只写到 MCP 本身——它怎么定义 Host/Client/Server,怎么发现和调用工具,怎么处理需要人介入的场景。但还有一个问题没有展开:**当 Agent 不再是"一个模型 + 一堆工具",而是"很多个 Agent 互相协作"的时候,又会撞上什么新问题?** 这正是下篇要讲的 A2A(Agent-to-Agent)。同一条主线还会继续往下走:每一层新协议,都是因为上一层刚好解决不了下一个问题。
