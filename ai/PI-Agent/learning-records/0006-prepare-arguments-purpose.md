# 纠正：prepareArguments 的动机不止"模型序列化差异"，还有 schema 版本演进

用户读 dg-ai-notes ch05-tools 时，文章把 `AgentTool.prepareArguments` 的存在完全归因于"不同模型 API 序列化工具参数的微妙差异"（举例：某些模型把 `edits` 数组序列化成 JSON 字符串）。用户提出自己的理解——"schema 给 LLM，参数不符合预期应该拒绝"——并对文章的解释感到困惑。

对照源码（`agent-loop.ts:616-618`）确认：用户的判断依然成立，`prepareArguments` 并没有取代拒绝逻辑——它在 `validateToolArguments` **之前**运行，只做形状修复；修复完之后仍要过严格的 schema 校验，不合格照样拒绝。

进一步对照 `harness/tools/edit.ts:55-77`（`prepareEditArguments`）发现它实际处理**两类不同的问题**：
1. `edits` 被序列化成字符串 → JSON.parse 还原（对应文章举的例子，模型/provider 序列化怪癖）
2. legacy 扁平 `oldText`/`newText` → 自动搬进 `edits[]`（Edit 工具自身 schema 从"单个编辑"升级到"批量编辑"后的兼容）

`pi/packages/agent/CHANGELOG.md:372` 给出这个 hook 被加入时的原始动机：「enabling compatibility shims for **resumed sessions with outdated tool schemas**」——第一动机是会话恢复时 schema 版本演进，跟"哪个模型"无关。文章只提到了第二类现象（模型怪癖），把设计动机完全归因于"模型 API 差异"，与源码自己的 CHANGELOG 描述不完全对应。

**对后续教学的影响**：这是又一次"外部教程对代码动机的归因不完全准确"的案例（类似 [[0002-tool-execution-strategy-misconception]] 的模式，但这次误差来自二级资源而非用户自己的猜测）。教训：遇到"这段代码为什么存在"这类设计动机问题，如果有 CHANGELOG/commit message/docs 里的一手表述，优先信这个，而不是二级教程的归因——二级教程会举一个真实但不完整的例子，容易让读者以为例子就是全部动机。已同步进 `reference/0003-tool-call-lifecycle.html` 新增的「拆解②」小节。

**追加确认（同一轮对话）**：用户进一步指出这是"非常好的回调点"——不只是 Edit 工具的特殊补丁，而是通用设计。核实属实：`prepareArguments` 类型定义在每个工具都有（`types.ts:393`），且在 `coding-agent/core/extensions/types.ts:467` 明确暴露给第三方扩展开发者（官方注释：「Optional compatibility shim to prepare raw tool call arguments before schema validation」）。但目前整个仓库只有 Edit 工具真正用它——通用回调点 ≠ 被广泛使用，这是"provisioned but narrowly used"的又一例（弱对照 Lesson 9 的"provisioned but *not* used"空壳发现）。另外 `coding-agent/core/tools/edit.ts:123` 的源码注释直接点名真实模型「Some models (Opus 4.6, GLM-5.1) send edits as a JSON string instead of an array.」——证实模型序列化怪癖不是猜测的场景，是开发者观察到的真实现象，dg-ai-notes 文章举的例子本身没错，只是不该被当成唯一动机。
