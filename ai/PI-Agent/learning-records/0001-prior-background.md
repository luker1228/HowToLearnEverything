# 起点背景：TS 熟练，Agent/LLM 框架是新手

用户在第一次会话中明确表示：TypeScript 写起来没问题，但没接触过 LLM Agent 框架的设计（事件循环、工具调用协议等概念对他比较新）。同时确认学习目的是「系统性理解 Agent 架构」，把 `pi-agent-core` 当作高质量参照实现，而不是要去维护/贡献 `pi` 仓库本身。

**对后续教学的影响**：不需要花时间讲解 TypeScript 语法本身（泛型、类型收窄等可以直接用，不必额外铺垫）；但任何 Agent 领域的术语（tool call、streaming event、context window、compaction 等）第一次出现时都需要给出定义，不能假设已知。优先从「大图」（Agent 整体架构）切入，再逐个模块深入，避免一开始就扎进 `harness/` 某个子模块的细节。
