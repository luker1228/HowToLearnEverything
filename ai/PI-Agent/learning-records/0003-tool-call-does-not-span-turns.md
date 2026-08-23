# 纠正：一个 tool_call 会不会跨 turn

用户提出假设「一个 tool_call 可能持续多个 turn 才能完成」，经代码对照（`runLoop` 会 `await executeToolCalls(...)` 完毕才发 `turn_end`，`agent-loop.ts:214-224`）纠正为：**单个 tool_call（同一个 `toolCallId`）绝不跨 turn**，`tool_execution_start → tool_execution_update* → tool_execution_end` 整条链路必然落在它所属的那一个 turn 内。真正会跨多个 turn 的是「模型反复多次调用同一个工具」——但那是多个各自独立、各自绑定一个 turn 的 tool_call，不是同一个 tool_call 跨越多轮。

**对后续教学的影响**：用户对 turn/tool_call 的边界已经建立了准确的因果直觉（模型决策 vs harness 执行边界，见 [[0002-tool-execution-strategy-misconception]]），且习惯于先提出自己的推测再让我验证——这个模式在后续课程（尤其 Lesson 3 讲工具执行细节）里应继续沿用：鼓励他先猜，再用源码逐条验证/纠正，而不是直接讲结论。
