---
title: Function Call 与 MCP：问答备忘（博客资料）
date: 2026-08-29
status: draft
type: source-notes
tags:
  - agent
  - function-calling
  - mcp
  - blog-prep
aliases:
  - function call 博客资料
  - MCP 为什么存在
related:
  - "[[为什么早期的大模型，通过Prompt让模型输出JSON不可靠]]"
---

# Function Call 与 MCP：问答备忘

> 这不是成稿。按一次连续问答整理，后续抽成博客。
> 资料来源以公开文档/论文为主，不把本地仓库当知识库。

## 写作定位

读者：写过一点 Agent / 调过 API，但把 function call、ReAct、OpenAPI、MCP 混在一起的人。

一条主线：

1. 模型只会吐 token
2. function call 让它会提出结构化调用
3. MCP 让调用背后的工具可插拔
4. 能力是后训练教出来的，执行永远在模型外面

成稿用词：不要用「工单」。它像客服/运维里排队处理的单据，第五节的「下工单」更像把活派给别的系统，正好和「function call 并没有连上别的应用」对着干。统一用「结构化调用 / 提出调用」。

成稿时建议拆成 2～3 篇，不要一篇塞完：

- 篇 A：Function call 是什么、以前怎么干活、为什么原始模型不会调工具、怎么训出来
- 篇 B：MCP 解决的是另一层问题，和 function call / OpenAPI 怎么叠；Host≠LLM；elicitation
- 篇 C（可独立短文）：给存量服务加 MCP 外壳——订单服务例子

---

## 0. 先把三层钉死

后续每道题都回到这张图，避免写成「MCP 取代了 function call」。

```text
模型  --function / tool call-->  宿主 (Agent runtime)
                                   --MCP tools/call-->  MCP Server
                                                        --真正干活--> GitHub / DB / 本地文件
```

| 层 | 谁跟谁说话 | 解决什么 | 没有它时 |
|---|---|---|---|
| Function / tool calling | 模型 ↔ 当前这个运行时 | 模型如何稳定提出「调用」 | prompt 约定格式 + 正则抠文本 |
| 手写 glue / OpenAPI | 运行时 ↔ 某个 HTTP 服务 | 这一次怎么调通一个 API | 每个客户端自己包 tool |
| MCP | 运行时 ↔ 可复用的工具进程 | 发现、插拔、跨宿主复用 | 每个 AI 应用把同一套 tool 写一遍 |

> [!important] 一句话
> Function call 让模型会提出调用；Agent 负责办事；MCP 让工具可以插拔。MCP 不替代 function call。

---

## 1. 什么是 function call？

**原问：** 什么是 function call？

### 结论

在 Agent / LLM 语境里，function call（现在也常叫 tool calling）不是模型自己去跑代码，而是模型发出一条**结构化的「请帮我执行这个函数」请求**，由程序真正执行。

OpenAI 2023-06 先叫 `functions`，2023-11 DevDay 改成 `tools`。名字变了，机制没变。

### 和编程里的 function call 不一样

| | 编程里的 function call | LLM 的 function calling |
|---|---|---|
| 谁发起 | 代码写 `add(1, 2)` | 模型输出 `name` + `arguments` |
| 谁执行 | CPU 立刻跑函数体 | 运行时 / Agent 去调真实函数 |
| 结果去哪 | 返回值回到调用处 | 结果再塞回对话，模型继续说或继续调 |

### 一次调用长什么样

1. 请求里带工具说明书（JSON Schema）
2. 模型不直接回答，返回类似：

```json
{
  "name": "get_weather",
  "arguments": { "city": "北京" }
}
```

3. 程序执行真正的 `get_weather("北京")`
4. 以 `tool` 消息回灌，模型再生成自然语言

### 写作可用的比喻

- 模型是会说话、没有手的实习生
- function call 是它会写的结构化调用，不是它的手
- `content` 给人看，`tool_calls` 给程序跑

### 资料

- [OpenAI: Function calling and other API updates](https://openai.com/index/function-calling-and-other-api-updates/)（2023-06-13）
- 现有相关笔记：[[为什么早期的大模型，通过Prompt让模型输出JSON不可靠]]

---

## 2. 为什么需要 function call？没有之前是怎么工作的？

**原问：** 为什么需要 function call，没有之前是怎么工作的？
**补充：** 不要用本地仓库当知识库，去网上搜。

### 结论

需要它，是因为模型只会说话，程序却要办事。没有它之前也能「用工具」，但协议是软的：用 prompt 规定格式，再从散文里抠函数名和参数。

Function call 没有发明 Agent 循环（想 → 动手 → 看结果）。它发明的是更硬的「动手协议」。

### 没有它时的四代做法

**1. 纯聊天**

`messages` → 一段 `content`。不知道现在几点，算术和事实查询经常翻车。要查天气只能人自己查再粘回去。

Toolformer 论文点过这个悖论：大模型在新任务上很强，但在算术、事实查询上反而比专用小模型差。

**2. 研究里的工具增强（2021–2023）**

| 工作 | 时间 | 做法 |
|---|---|---|
| WebGPT | 2021 | 训练模型去浏览网页 |
| PAL | 2022 | 把计算甩给 Python |
| ReAct | 2022.10 | prompt 让模型交错输出 Thought / Action / Observation |
| Toolformer | 2023.02 | 自监督在文本里插入 API 调用 |

ReAct 的动作当时是纯文本，例如 `search[Apple CEO]`。没有独立的 `tool_calls` 字段。

**3. 工程土办法：prompt + 正则（prompt and pray）**

LangChain 早期 `ZERO_SHOT_REACT_DESCRIPTION` 就是这条路：

```text
Thought: ...
Action: get_weather
Action Input: Boston
```

失败模式：JSON 外套解释、工具名写错、用户一句话冲掉格式、解析失败整轮重试。

**4. 产品实验：ChatGPT Plugins（2023.3）**

用 OpenAPI 描述第三方 API。已经很像后来的 function calling，但是产品级插件市场，不是通用 API 能力。发现难、质量参差、安全模型不成熟。2024-04 关停，迁到 GPTs / Actions。

OpenAI 在 function calling 公告里写：从 plugins alpha 学到了如何让工具和语言模型安全协作。

### Function call 具体补了什么

| | ReAct / prompt | Native function calling（2023.6 起） |
|---|---|---|
| 工具怎么告诉模型 | 写在 prompt 里 | JSON Schema，作为 API 参数 |
| 模型怎么表示「要动手」 | 混在 `content` 里 | 独立字段 `function_call` / 后来的 `tool_calls` |
| 可靠性 | 提示词 + 解析器 + 重试 | 为这件事微调过的模型 + schema |
| 解析 | 正则抠文本 | 结构化字段，程序直接读 |

### 时间线（成稿可做成图）

```text
2022 前     补全/聊天，纯文本
2022.10     ReAct：prompt 约定 Thought/Action
2023.02     Toolformer
2023.03     ChatGPT Plugins
2023.06     OpenAI Function Calling（gpt-4-0613 / gpt-3.5-turbo-0613）
2023.11     tools 取代 functions；并行调用；JSON mode
2024.05     Anthropic tool use 正式开放
2024.11     MCP 开源
```

### 它解决不了什么

Schema 合法不等于事情做对。用户说「先别创建，给我看示例」，模型仍可能输出 `{"action":"create"}`。权限、业务校验、危险操作确认、审计，还在执行层。

### 资料

- [ReAct, arXiv:2210.03629](https://arxiv.org/abs/2210.03629)
- [Toolformer, arXiv:2302.04761](https://arxiv.org/abs/2302.04761)
- [OpenAI function calling 公告](https://openai.com/index/function-calling-and-other-api-updates/)
- [Nathan Lambert, RLHF Book ch.13 Tool Use](https://rlhfbook.com/c/13-tools)

---

## 3. MCP 的原因是什么？是不是客户端 vs 服务端？

**原问：** MCP 的原因是啥。我理解 tool call 相当于在客户端搞，MCP 就是服务端搞。比如一个小众服务，没有 MCP 之前只能通过 OpenAPI 调用，需要客户端写这个 tool；MCP 出来之后，只需要配置好 MCP，就可以自由发现工具了。对吧。

### 结论：方向对，分层差一点

MCP 不是「把 tool call 从客户端搬到服务端」，而是解决 **M 个 AI 应用 × N 个工具 = 爆炸式重复对接**。

Anthropic 2024-11-25 原话：每个新数据源都要自己做一套对接，真正连起来的系统很难规模化。后来常叫 **N×M 问题**，灵感来自 IDE 的 Language Server Protocol。USB-C 比喻也是这个意思：统一插头，不是统一电器。

### 用户判断里对的部分

小众服务如果自己发一个 MCP server，Cursor / Claude Desktop / 你的 Agent 只要配上，就能 `tools/list` 发现、`tools/call` 调用。服务方写一次，各家客户端不用各自再包一层 tool。

### 需要改的：不是客户端 vs 服务端

更准确是三层，见文首图。

- Tool call **没有被 MCP 替代**。Host 发现到 MCP 工具后，仍然要把 schema 交给模型，走 function calling。
- MCP Server **不一定在云上**。最早一批是本机 `stdio`：Claude Desktop 拉起本地进程。本地文件、本机浏览器、本机 DB 全是合法 MCP。

把 MCP 理解成「服务端搞」，会漏掉一半场景。

### 和 OpenAPI 也不是「以前只能 OpenAPI」

没有 MCP 时常见三条路：

1. 在客户端手写 tool（function calling 的默认形态）
2. 读 OpenAPI，自动生成 tool（ChatGPT Plugins / GPT Actions）
3. 每个 AI 产品各写一套插件

OpenAPI 描述的是任意 HTTP 客户端都能调的 REST。MCP 是 AI 宿主如何发现、会话式调用、带上下文地连上能力。一个 MCP server 经常包一层 OpenAPI/REST，再补 resources、prompts、会话状态。

| | OpenAPI | Function calling | MCP |
|---|---|---|---|
| 合同 | 无状态 HTTP | 这一次 LLM 请求里的函数清单 | 运行时总线（JSON-RPC） |
| 发现 | spec 文件，偏静态 | 每次请求静态塞 tools | `tools/list`，可 `listChanged` |
| 为谁设计 | 任何人/服务 | 单个应用内的模型 | AI 宿主 ↔ 工具提供方 |

### 「配好就能自由发现」的边界

对的：连上某个 server 后，工具列表运行时拉；server 加了新 tool，client 再 list 就能看到，不必改客户端代码。

不对的引申：

- 不是全网自动搜到任意小众服务，还是要配置连接（本地命令、URL、OAuth）
- 没人发 MCP server，你依然得自己写——只不过写的是可复用 server
- 工具一多会撑爆上下文，生产里还要过滤 / 按需加载

MCP 不止 tools，还有 **resources**（当上下文读的数据）和 **prompts**（可复用提示模板）。

### 何时还用手写 function calling

一个应用内部、几个动作、要低延迟、逻辑就在自己进程里：继续 function calling 就够。

跨宿主复用、给别人的 Agent 接入、工具会变、要连本地资源：才上 MCP。

### 资料

- [Anthropic: Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol)
- [MCP spec: Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [Wikipedia: Model Context Protocol](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- [MCP vs Function Calling vs OpenAPI](https://www.marktechpost.com/2025/10/08/model-context-protocol-mcp-vs-function-calling-vs-openapi-tools-when-to-use-each/)

---

## 4. 它们是不是在解决不同问题？没有 MCP 之前是不是用 function call 连不同应用？

**原问：** 看起来他们是解决不同的问题。只是没有 MCP 之前，可以用 function call 来解决模型到不同应用之间的问题。

### 结论

现象对，机制要拆开。

这不是 function calling 的缺陷。它本来就只负责让模型向**当前这个程序**发出结构化调用。连 GitHub / Slack 的，是运行时接到这次调用之后你手写的胶水——那是这层协议的正常工作方式，不是漏掉的功能。

```text
模型 --function call--> 你的 Agent
                          ├── 手写 get_github_issue()  → GitHub API
                          ├── 手写 send_slack()        → Slack API
                          └── 手写 query_db()          → 数据库
```

Function calling 从来不是为跨应用集成设计的。N×M 是胶水这一层规模化之后才出现的新问题，不该由它来回答。

有了 MCP 之后，function calling **还在**：

```text
模型 --function call--> 宿主 --MCP tools/call--> GitHub MCP Server → GitHub
```

变的是后半段：胶水从「每个 app 里的 tool 函数」变成「可发现的标准 server」。

> [!tip] 成稿可用的收束句
> 它们一直在解决不同问题。function calling 负责模型 ↔ 当前运行时；跨应用复用从来不是它的职责。现在不该互相替代，该叠着用。

---

## 5. 原始 LLM 为什么不会调用工具？

**原问：** 原始的 LLM 为啥不会调用工具？

### 结论

不是产品缺功能，是机制上就没有手。原始 LLM 是条件概率模型：给定前面的 token，预测下一个 token。输出永远是词表里的编号，不是系统调用。

$$
P(x_{t+1} \mid x_1, x_2, \ldots, x_t)
$$

### 「不会调」缺了三样东西

**1. 没有世界接口**

没有网卡、文件系统、时钟、数据库句柄。权重是静态快照。写出 `open("/tmp/a.txt")` 也只是字符。本地模型常见翻车：它说「文件写好了」，目录里没有文件。

学术定义：工具是跑在 LM **外面**的程序，模型只负责生成调用文本和参数。

**2. 原始模型没被训成「发出可执行的调用」**

基座训练目标是续写网页、书、对话。数据里几乎没有「这里该停下来、吐一个符合 schema 的函数调用」。所以它会：用记忆编天气、用话术说「我去帮你查」、把伪代码打印在回复里。

2023-06 的关键一步是**专门微调**，不是 Transformer 自带的。

**3. 没有执行器，格式对了也是空转**

OpenAI 自己也写：所谓 use a tool，只是模型 **propose** 一次调用。必须有 orchestrator。另外工具往往在防火墙里，模型 API 在外面；危险操作需要人确认——工程上也不该让模型直连。

### 成稿可用对照表

| 现象 | 原因 |
|---|---|
| 模型说「我已经搜过了」 | 在续写「助手做完事」的话术，没有搜索发生 |
| 算术偶尔错得离谱 | 拟合数字的文本分布，不是在跑计算器 |
| 很多本地模型 tool 很烂 | 没为这个格式做后训练，或 chat template 对不上 harness |
| 即使用了 tool call 也会乱调、漏调 | 调不调仍是下一个 token 的抽样 |

### 资料

- [What Are Tools Anyway?, arXiv:2403.15452](https://arxiv.org/html/2403.15452)
- [The hard limit of prompting](https://towardsai.net/p/machine-learning/the-hard-limit-of-prompting-and-why-ai-agents-need-tools)
- [Lambert 课：模型权重只能生成 token](https://www.youtube.com/watch?v=GMry2DzC304)
- [OpenAI: the model only proposes a tool call](https://openai.com/fil-PH/index/equip-responses-api-computer-environment/)

---

## 6. 所以模型只是按 schema 输出了一个 tool query，然后交给 Agent 执行？

**原问：** 他只是按照 tool 约定好的 schema 输出了一个 tool query 对吧。然后交给 agent 执行。

### 结论

对。模型没有执行任何工具，只是按约定格式吐出一次调用意图。

三步：

1. 请求里先把工具说明书给它
2. 模型只生成一次结构化调用（`name` + `arguments`）
3. Agent / 运行时接走、执行、把结果塞回去

### 需要收窄的两处用词

- 模型并不是主动「交给」Agent。它仍然只是在生成 token；**运行时看到这是 `tool_calls` 而不是普通 `content`，才去执行。**
- 执行的是 **宿主里的循环**（常叫 agent loop）。Agent 是整套系统，不是模型本人。
- 「tool query」口语能懂，成稿建议写成 **tool call / 结构化调用**，避免和搜索 query、HTTP request 混。不要用「工单」。

> [!success] 可直接进正文的句子
> 模型负责提出调用，Agent 负责办事，办事结果再变成下一轮输入。

---

## 7. 大模型的 Function Call 能力是怎么训练出来的？

**原问：** 大模型的 Function Call 能力是怎么训练出来的？

### 结论

不是预训练里长出来的，是后训练专门教的一种说话方式。训练要做的，是让「该动手时」最高概率的那串 token 变成一次符合 schema 的结构化调用。

OpenAI 原话：模型被 fine-tuned，「判断要不要调函数，并吐出贴着函数签名的 JSON」。配方没公开，公开论文和开源训练把主路径写清楚了。

### 教的不是执行，是发出对的 token

训练样本形状（Together / Azure 微调文档同一套）：

```text
输入：
  tools = [get_weather 的 JSON Schema, ...]
  user  = "旧金山现在多少度？"

目标输出（assistant）：
  tool_calls = [{
    "name": "get_weather",
    "arguments": {"location": "San Francisco"}
  }]

然后：
  tool 角色：{"temp": 18}
  assistant：旧金山现在大约 18°C。
```

SFT 就是普通 next-token 交叉熵，目标从「写一段回答」换成「先写出这段结构化调用」。

要学的三件事（Lambert）：何时发调用、如何把参数填对、如何把工具结果写进后续回复。

### 数据几乎全是合成轨迹

人标太贵。

| 路线 | 代表 | 怎么造 |
|---|---|---|
| 自监督插调用 | Toolformer（2023） | 在语料里插入 API 调用，真执行，只保留有助于预测后文的，再微调 |
| 海量真实 API | Gorilla、ToolLLM / ToolBench | 几千到上万真实 API 生成 query 和轨迹 |
| 多智能体合成 + 校验 | ToolACE | 自演化 API 池 + 多 agent 对话 + 双层校验，再 SFT |
| 厂商后训练 | Llama 3 技术报告 | 合成必须用工具的问题 → 生成调用 → 执行 → 最终答案；另造未见过的 `(schema, query, call)` 练 zero-shot |

Llama 3 刻意练了 **zero-shot function calling**：推理时给你一套训练时没见过的工具定义，仍要能按 schema 填对。所以可以临时塞一个新 tool，不必为每个 API 单独训一遍。

### 目标怎么叠：SFT → 偏好 → 环境 RL

**SFT 打底**

- 只对 assistant / `tool_calls` 算 loss
- user 消息和 **tool 返回值要 mask**（`-100`），否则模型在学「扮演环境」
- 工具定义必须按 **chat template** 编进上下文；推理模板不一致，调用会打成普通文本

**DPO 等偏好学习**

同一问题，好轨迹 vs 坏轨迹：该调却直接编答案、调不存在的工具、参数类型错。校正「调不调、调哪个」。

**带环境的 RL（PPO / GRPO）**

多步 Agent 更像经典强化学习：与工具环境滚一整条轨迹，最后看任务成不成。SFT 解决「会按 schema 写出调用」；RL 解决「这条调用链能不能把事办成」。

### 训练之后，推理时还靠两样外挂

1. 每次请求仍要把当前 tools schema 放进上下文。模型没把你的业务函数记进权重，学的是「看见 schema 就填」。
2. 很多系统再用 constrained decoding / `strict`。这是推理约束，不是训练本身。

```text
预训练：会说话
    ↓
SFT 工具轨迹：会按 schema 写出调用
    ↓
DPO / RL：更会判断何时调、多步是否成功
    ↓
推理：chat template +（可选）语法约束解码
    ↓
运行时：真正执行，结果再喂回去
```

### 资料

- [OpenAI 2023-06 公告](https://openai.com/index/function-calling-and-other-api-updates/)
- [Lambert ch.13](https://rlhfbook.com/c/13-tools)
- [Llama 3 Herd of Models](https://ar5iv.labs.arxiv.org/html/2407.21783)（Tool datasets / zero-shot tool use）
- [ToolACE](https://arxiv.org/abs/2409.00920)
- [Together: Function-calling fine-tuning](https://docs.together.ai/docs/fine-tuning/function-calling)
- [NVIDIA NeMo: Multi-Turn Agent SFT](https://docs.nvidia.com/nemo/automodel/latest/recipes-e2e-examples/agent-sft)
- [Azure: Fine-tuning function calls](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/fine-tuning-functions)

---

## 8. 什么是 MCP？核心内容是什么？

**原问：** 什么是 MCP（模型上下文协议）？讲讲它的核心内容？

### 结论

MCP（Model Context Protocol）是 Anthropic 于 2024-11-25 开源的开放标准：给 AI 应用（宿主）和外部系统之间规定一套**如何交换上下文、如何发现并调用能力**的协议。官方自己划边界：

> MCP 只管上下文交换协议，不管 AI 应用怎么用 LLM、怎么管理这些上下文。  
> [Architecture overview](https://modelcontextprotocol.io/docs/learn/architecture)

常说的 USB-C / LSP 比喻指的是：写一次 server，Cursor、Claude Desktop、你的 Agent 都能连。它不替代 function calling——宿主发现到工具后，仍然把 schema 交给模型走 tool call。

### 三个角色

| 角色 | 是什么 | 例子 |
|---|---|---|
| **Host** | AI 应用，创建并管理多个 client，管权限和用户确认 | Claude Desktop、Cursor、VS Code |
| **Client** | Host 内部、一对一连某个 server 的连接器 | VS Code 连 Sentry 时实例化的那个 client 对象 |
| **Server** | 提供上下文和能力的程序，本地或远程都行 | 本机 filesystem、远程 Sentry MCP |

Host 连 N 个 server，就有 N 个 client。Local stdio server 通常一对一；远程 HTTP server 通常一对多。

规范原文写得很清楚：MCP **server 指的是提供上下文的程序，跟它跑在哪无关**。本机拉起的 filesystem 是 local server；Sentry 平台上的是 remote server。

```text
┌──────────── MCP Host（Cursor / Claude Code）────────────┐
│  Client1 ──stdio──► Server A  本地文件系统              │
│  Client2 ──stdio──► Server B  本地数据库                │
│  Client3 ──HTTP───► Server C  远程 Sentry               │
└─────────────────────────────────────────────────────────┘
                          │
                    仍要把 tools schema
                    交给模型做 function call
```

### 两层：数据层 + 传输层

**数据层（JSON-RPC 2.0）**  
消息长什么样、有哪些方法：发现、tools/resources/prompts、通知。所有传输用同一套消息。

**传输层**  
消息怎么运：

| 传输 | 怎么连 | 适合 |
|---|---|---|
| **stdio** | Host 把 server 当子进程拉起，stdin/stdout 换行分隔 JSON-RPC | 本机工具、文件、个人配置 |
| **Streamable HTTP** | 一个 HTTP 端点，客户端 POST；响应可以是 JSON 或该请求范围内的 SSE | 远程、多客户端、OAuth |

早期还有 HTTP+SSE（2024-11-05），2025-03-26 起被 Streamable HTTP 取代，新 server 不要再用。stdio 不走 MCP 的 HTTP 授权规范，凭据从环境变量/本地文件来；远程 HTTP 才用 OAuth / bearer。

### 核心原语：Server 暴露三样

这是 MCP「核心内容」里最该写进博客的部分。官方定义三种 **server primitives**：

| 原语 | 给谁用 | 干什么 | 典型方法 |
|---|---|---|---|
| **Tools** | 模型（经宿主） | 可执行动作：读文件、调 API、查库 | `tools/list` → `tools/call` |
| **Resources** | 应用 / 模型当上下文 | 只读数据：文件内容、表结构、API 响应 | `resources/list` → `resources/read` |
| **Prompts** | 用户 / 应用 | 可复用交互模板：系统提示、few-shot | `prompts/list` → `prompts/get` |

Tools 是**模型控制**的：模型根据用户意图决定调不调。Resources / Prompts 更像应用侧塞上下文，不一定每轮都进模型。

一个数据库 MCP 的典型拆法：

- Tool：`query_sql`
- Resource：数据库 schema
- Prompt：带 few-shot 的「怎么问这套库」

工具对象的关键字段：`name`、`title`、`description`、`inputSchema`（JSON Schema）。调用时 `name` 必须和 list 里的完全一致。

`tools/call` 返回的是 `content` 数组，可以是 text / image 等多种块，再由宿主塞回模型。

### Client 也能暴露能力

Server 可以反过来向宿主要东西：

- **Elicitation**：server 请用户补信息或确认危险操作（`elicitation/create`）
- **Sampling**（2026-07-28 起废弃）：以前让 server 借宿主的模型做补全，新实现应自己接 LLM API
- **Roots**：询问允许操作的文件系统/URI 边界

权限和确认在 **Host**，不在模型，也不在 MCP server 里偷偷做。

### 一次典型交互

稳定概念（各版本细节有差异，成稿写概念即可）：

```text
1. 发现    server/discover（或早期的 initialize）
           交换协议版本、capabilities（支不支持 tools / resources / 变更通知）
2. 列工具  tools/list
           拿到 name + inputSchema，宿主再转成模型的 function schema
3. 调用    tools/call { name, arguments }
           server 执行，返回 content
4. 可选    订阅 tools list 变更通知，变了再 list 一次
```

`tools/list` 是运行时发现：server 加了新工具，不必改客户端代码。这不是全网搜索，只发现**已经配上的那几个 server**。

### 规范明确不管什么

- 不管模型怎么选工具（那是 function calling）
- 不管 Agent loop 怎么写
- 不管上下文怎么压缩
- 不管你的业务鉴权语义（MCP 只提供连接/OAuth 框架，执行权限仍是 server + host 的事）

### 和前面几问的衔接（写篇 B 时用）

- Function call：模型 ↔ 宿主的结构化调用
- MCP：宿主 ↔ 工具进程的发现与调用
- OpenAPI：描述无状态 HTTP；MCP server 常常包一层 OpenAPI，再补 resources / prompts / 会话式发现

### 资料

- [Anthropic 发布公告](https://www.anthropic.com/news/model-context-protocol)
- [Architecture overview](https://modelcontextprotocol.io/docs/learn/architecture)（Host/Client/Server、原语、传输，首选）
- [Specification](https://modelcontextprotocol.io/specification/latest)
- [Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- 规范在演进：`initialize` → 更偏 `server/discover`；HTTP+SSE → Streamable HTTP；Sampling 已 deprecated。成稿讲核心原语即可，线协议细节用「以当时规范为准」带过。

---

## 9. 为什么是 JSON-RPC 2.0？模型写不出 protobuf 吗？

**原问：** 为什么是 JSON-RPC 2.0。感觉方便 agent 调用。如果是二进制协议，agent 应该写不出来是吧。比如 protobuf。

### 结论：直觉落在了错误的那一层

**模型通常不写 JSON-RPC。** Host 里的 MCP Client 写 JSON-RPC；模型写的是 function call（`name` + `arguments` 的 JSON）。换成 protobuf，Agent 照样可以调工具——只要宿主会编解码。

「方便 agent」成立的地方是：

- 进模型、出模型的那一层本来就是 JSON（schema、参数、工具返回的文本）
- 动态发现（`tools/list`）和运行时新工具，跟「先编 .proto 再 protoc」打架
- 让模型/人写一个 MCP server 时，print JSON 比生成二进制帧容易得多

不是「Agent 不会说 protobuf 所以 MCP 才用 JSON」。

### 真正选型理由（官方/作者侧）

MCP 明确抄了 LSP：JSON-RPC + 双向 + 解决 M×N。作者 David Soria Parra 说，JSON-RPC 这种「无聊的部分」是刻意的，创新放在 Tools / Resources / Prompts 这些原语上。[Latent.Space 访谈](https://www.latent.space/p/mcp)

JSON-RPC 2.0 刚好够用：

1. **传输无关**：同一套消息跑 stdio、HTTP、自定义通道。gRPC 绑 HTTP/2，塞不进「拉起一个本地脚本、stdin/stdout 说话」。
2. **双向**：任何一方都能发 Request。MCP 需要 server 反过来问用户（elicitation）。REST 默认单向；gRPC 能双向但栈重。
3. **三种消息**：Request / Response / Notification。通知用来推 `tools/list_changed`，不必每次都回包。
4. **零代码生成**：每种语言都会 JSON。10 行 Python `print` 就能当 server。protobuf 要 `.proto` + `protoc` + stub。
5. **动态 schema**：工具列表运行时变。protobuf 偏编译期合同；MCP 的工具合同在 `tools/list` 的 JSON Schema 里。
6. **可读、好调**：stdio 日志就是明文。二进制必须解码器。

社区也问过「为什么不用 protobuf/gRPC」（[Discussion #1144](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1144)）。回应方向是：能用，尤其远程高性能；但和 stdio-first、零门槛、动态工具这批目标不合。后来有 SEP 把 payload 从 JSON-RPC method 上解耦，方便将来绑 gRPC，**线上 JSON-RPC 暂不换**。[SEP-1319](https://modelcontextprotocol.io/seps/1319-decouple-request-payload-from-rpc-methods-definiti)

### 成稿可用的分层图

```text
模型   →  function call JSON（模型会写，也是这么训的）
宿主   →  JSON-RPC（宿主写，模型通常看不见）
server →  真去调 GitHub / 读文件
```

Protobuf 卡住的是中间那一层的实现门槛，不是模型写出调用。

### 资料

- [Latent.Space: The Creators of MCP](https://www.latent.space/p/mcp)
- [GitHub Discussion #1144 Why not Protobuf/gRPC](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1144)
- [Google Cloud: gRPC as a custom transport for MCP](https://cloud.google.com/blog/products/networking/grpc-as-a-native-transport-for-mcp)
- [SEP-1319](https://modelcontextprotocol.io/seps/1319-decouple-request-payload-from-rpc-methods-definiti)

---

## 10. Host 是 LLM 吗？模型怎么调到 MCP？

**原问：** 所谓宿主，就是 LLM？ / 模型是怎么调用 MCP server 的呢？也是利用一个 mcp function call？

### 结论

Host 是 **AI 应用**（Cursor、Claude Desktop、自研 Agent 进程），不是那颗模型。LLM 只是 Host 内部调用的大脑。

模型**不会**调 MCP Server，也没有一种特殊的「MCP function call」。它仍是普通 `tool_calls`。Host 把 MCP 的 `tools/list` 转成这次请求里的 `tools` 数组；模型写出这次调用后，Host 再查表转发成 JSON-RPC `tools/call`。

```text
模型  --tool_calls-->  Host  --tools/call-->  MCP Server
       function calling         JSON-RPC
```

对模型来说，内置 `Read` 和来自 MCP 的 `create_issue` 长得一样。有的产品给名字加前缀（`mcp_github_create_issue`）只为 Host 路由，不是新协议。

Server 可以反过来找 **Host**（elicitation、list 变更），仍然不能找模型。

---

## 11. Elicitation 真实例子

**原问：** 写一个真实的 elicitation 例子。Server 没有 LLM，为什么会问是否删除？是二次校验吗？参数错了会二次索要吗？

### 结论

Elicitation 是 tool **执行到一半**，没有 LLM 的 MCP Server 用**写死的 if** 暂停，请 Host 给人弹表单（或打开 URL），拿到答案后再干完。

- 问的是**人**，不是模型
- 敏感确认是其中一种用法，不是全部（还可选账号、OAuth、歧义点选）
- **参数格式错误**默认报错回灌给模型，模型改调用再发一次；那不是 elicitation

两种「再要一次」不要混：

| | 谁被问 | 像什么 |
|---|---|---|
| tool 报错回灌 | 模型 | Agent 循环，二次改调用 |
| Elicitation | 人 | Host 弹窗 / 打开 URL |

Host 还可以在 `tools/call` **发出去之前**自己弹权限框。那是宿主策略，不是 elicitation。

### 订桌（官方 SDK 思路）：参数合法，生意上订不了

你说：「订 12 月 25 日 19:00、4 人桌。」

1. 模型：`book_table({ party_size: 4, date: "2024-12-25", time: "19:00" })` —— date 合法，不是参数错误
2. Host → Server：`tools/call`
3. Server 普通 if：圣诞节没空桌，发 `elicitation/create`，请人另选日期
4. Host 弹表单，你填 `2024-12-26`
5. Host → Server：`{ "action": "accept", "content": { "alternate_date": "2024-12-26" } }`
6. Server 下单，结束原来的 `tools/call`
7. 模型只看到「已订 12月26日」，看不见弹窗

`elicitation/create` 形如：

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

人还可以 `decline` / `cancel`。另有 URL 模式：打开 GitHub OAuth / 支付页，敏感信息不必进模型上下文。

### 删除确认（同一套路）

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "确定删除 /data/prod.db 吗？此操作不可恢复。",
    "requestedSchema": {
      "type": "object",
      "properties": { "confirm": { "type": "boolean" } },
      "required": ["confirm"]
    }
  }
}
```

### 资料

- [MCP Elicitation](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)
- [Python SDK elicitation 示例](https://github.com/modelcontextprotocol/python-sdk/blob/main/examples/snippets/servers/elicitation.py)

---

## 12. 给存量订单服务加 MCP 外壳

**原问：** 有创建/查询/修改/下单 4 个接口，把 MCP 理解成服务的外壳，怎么加？

### 结论

外壳对了一半：MCP 是 **给 Agent 用的适配层**，不是四个 REST 换皮。存量 HTTP 继续给人/App 用；MCP Server 站在旁边调它们。工具按「Agent 想完成什么」切，不要 `GET/POST/PUT` 一一对应。

作者公开说过：REST 原样转 MCP 通常很糟。REST 给程序员组合小接口；Agent 每调一次都是一轮推理，接口碎了又贵又容易选错。

```text
前端 / App / 其他后端     ──REST──►  订单服务（原样）
Cursor / Claude / Agent   ──MCP──►  Order MCP Server  ──HTTP──►  同一套订单服务
```

MCP 里做：校验、裁剪返回、鉴权（token 在 server 环境变量）、分页重试、把 4xx 变成模型能改的错误、危险操作 elicitation。业务逻辑仍在原服务。

### 四个接口不要摊成四个 tool

| 存量接口 | 直接 1:1 的坑 | 建议 |
|---|---|---|
| 创建订单 | 和「下单」模型分不清 | 收到 place 后在 server 里建草稿 |
| 查询订单 | 返回太大 | `get_order`，只留 id/status/金额/地址/商品 |
| 修改订单 | 字段一多乱填 | `update_order`，白名单字段 |
| 下单 | 模型直接拍板 | 一个 `place_order`，内部创建+提交，elicitation 问人 |

Agent 故事优先：

- 「8821 什么状态？」→ `get_order`
- 「地址改成 …」→ `update_order`
- 「帮我下一单」→ **一个** `place_order`，不要让模型自己编排创建+提交

最小三个 tool 即可。查询第一版用 tool 比 Resource 更稳（很多宿主对 Resource 支持一般）。

### 薄适配器示意

原服务：`GET/PATCH /orders/{id}`，`POST /orders`，`POST /orders/{id}/place`。

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
        "id": o["id"],
        "status": o["status"],
        "amount": o["amount"],
        "address": o.get("address"),
        "items": o.get("items"),
    }

@mcp.tool
def update_order(order_id: str, address: str | None = None, remark: str | None = None) -> dict:
    """修改未提交订单的收货地址或备注。已下单的不要用。"""
    body = {k: v for k, v in {"address": address, "remark": remark}.items() if v}
    r = client().patch(f"/orders/{order_id}", json=body)
    r.raise_for_status()
    return {"id": order_id, "ok": True}

@mcp.tool
async def place_order(
    ctx: Context,
    sku: str,
    quantity: int,
    address: str,
    order_id: str | None = None,
) -> str:
    """创建并提交订单。真实下单，必须等人确认后再执行。"""
    elicit = await ctx.elicit(
        message=f"即将下单：{sku} x {quantity}，送到 {address}。确认提交吗？",
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
            created = c.post("/orders", json={
                "sku": sku, "quantity": quantity, "address": address
            })
            created.raise_for_status()
            order_id = created.json()["id"]
        placed = c.post(f"/orders/{order_id}/place")
        placed.raise_for_status()
    return f"已下单 {order_id}"
```

模型只看见三个 function；两次 REST 发生在 server 里。下单弹窗问人，不是让模型再填 `sku`。

### 怎么接到 Cursor / Claude

- 本机：stdio + 环境变量 token
- 团队：旁挂 Streamable HTTP（与订单服务同 VPC）
- 原 OpenAPI 不要删

### 清单

- 存量服务零改造或只加只读裁剪字段
- 工具 3～7 个，不要 40 个 GET
- description 写「何时用 / 何时不要用」
- 写操作返回 `{id, status}`，不要整单 dump
- 错误返回人话 + 可改字段
- `place_order` 做人确认；查单不必
- 凭证留在 MCP 进程，不进 tool schema

> [!tip] 成稿可用的收束句
> 外壳 = 面向 Agent 的门面，不是 REST 的透明代理。

### 资料

- [Phil Schmid: MCP servers are not thin wrappers](https://www.philschmid.de/mcp-best-practices)
- [WorkOS: Designing an MCP server from a REST API](https://workos.com/blog/designing-mcp-server-from-rest-api)
- [FastMCP: Connect LLM to REST API](https://gofastmcp.com/tutorials/rest-api)

---

## 成稿时建议的结构

### 篇 A 标题备选

- 模型不会调工具，它只会提出调用
- Function calling 是后训练教出来的说话方式
- 没有 function call 之前，Agent 靠正则从作文里猜意图

### 篇 A 提纲

1. 原始 LLM 在算什么（next token，没有手）
2. 没有协议时怎么「用工具」（ReAct / 正则 / Plugins）
3. function call 把「说话」和「伸手」分成两条通道
4. 模型只输出结构化调用，Agent 执行
5. 这个能力怎么训出来（SFT + mask + DPO/RL）
6. 它保证结构，不保证判断对

### 篇 B 标题备选

- Function call 提出调用，MCP 让工具可插拔
- 没有 MCP 之前，我们把集成问题焊在每个客户端里
- MCP 不是服务端版的 function call

### 篇 B 提纲

1. MCP 是什么：上下文交换协议，不管模型怎么用
2. 三个角色：Host / Client / Server（Host≠LLM；server 跟跑在哪无关）
3. 模型仍用普通 function call；Host 翻译成 tools/call
4. 核心原语：Tools / Resources / Prompts；elicitation 问人不是问模型
5. 传输：stdio vs Streamable HTTP
6. N×M 问题，纠正「客户端 vs 服务端」
7. 和 function call / OpenAPI 叠着用
8. 什么时候不要上 MCP（本进程已有 Read 就不必再包一层）

### 篇 C 提纲（存量服务）

1. 外壳不是 REST 换皮
2. 订单四接口 → 三个 tool + 下单 elicitation
3. 可运行适配器骨架
4. stdio / HTTP 怎么接、OpenAPI 保留

### 成稿里建议反复用的句子

- 模型负责提出调用，Agent 负责办事。
- ReAct 发明的是 loop，function call 发明的是结构化调用。
- Function calling 是当时唯一能用的原语，不是为跨应用集成设计的方案。
- MCP 不替代 function call，两者叠着用。
- Host 不是 LLM；模型没有 MCP function call。
- Elicitation 问人，参数错误回灌给模型。
- 外壳是面向 Agent 的门面，不是 REST 的透明代理。

---

## 容易写错的点（自检）

- [ ] 不要写「模型调用了 API」——它只生成了调用意图
- [ ] 不要写「MCP 取代了 function call」
- [ ] 不要把 MCP 说成必须在云端
- [ ] 不要把 OpenAPI 和 MCP 写成互斥
- [ ] 不要把 JSON mode 和 Structured Outputs / function calling 混成一件事（相关见 [[为什么早期的大模型，通过Prompt让模型输出JSON不可靠]]）
- [ ] 「tool query」成稿改成 tool call
- [ ] 训练部分强调：tool 返回值要 mask，执行不进梯度
- [ ] Plugins 是 2023.3 产品实验，function calling 是 2023.6 API 能力，不要时间线写反
- [ ] 不要写「宿主就是 LLM」
- [ ] 不要写「模型用 MCP function call 直连 server」
- [ ] 不要把 tool 报错重试写成 elicitation
- [ ] 不要把四个 REST 1:1 摊成四个 MCP tool 当最佳实践

---

## 还可以补的材料（写正文前）

- [ ] 一张三层图（模型 / 宿主 / MCP server），比纯文字更适合博客
- [ ] 一个最小 curl / Python 对照：同一天气问题，prompt-JSON vs native tool_calls
- [ ] 一个「没配 MCP vs 配了 MCP」的配置片段（Claude Desktop / Cursor 各一行）
- [ ] BFCL 作为 function calling 评测的一句带过即可，不必展开
- [ ] 本地小模型 chat template 对不上导致「说写了文件但没写」——很适合当反例
- [ ] 成稿时决定要不要点名 DeepSeek JSON mode vs OpenAI Structured Outputs（已有专文，本篇可内链，不必重写）
- [x] 订桌 elicitation 逐步 JSON（见第 11 节）
- [x] 存量订单服务 MCP 外壳示例（见第 12 节）
