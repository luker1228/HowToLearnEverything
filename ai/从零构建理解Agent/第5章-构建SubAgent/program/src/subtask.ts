import { Agent, Runner, tool, type Tool } from "@openai/agents";
import { z } from "zod";

type LogBusinessEvent = (event: string, payload: Record<string, unknown>) => Promise<void>;

type SubTaskDeps = {
  model: string;
  activeSessionId: () => string;
  activeReqId: () => string;
  cutText: (text: string, maxChars: number) => string;
  logBusinessEvent: LogBusinessEvent;
  toolRegistry: Record<string, Tool<unknown>>;
};

export function createSubTaskTool({
  model,
  activeSessionId,
  activeReqId,
  cutText,
  logBusinessEvent,
  toolRegistry,
}: SubTaskDeps) {
  return tool({
    name: "SubTask",
    description: "一次性子任务执行器。为子智能体提供隔离上下文（新 messages）和工具白名单，返回简短摘要；不做后台运行、不做持久化。",
    parameters: z.object({
      task: z.string().min(1),
      contextMessages: z.array(z.string().min(1)).default([]),
      allowedTools: z.array(z.string().min(1)).default(["ReadFile", "FindFile"]),
    }),
    async execute({ task, contextMessages, allowedTools }) {
      await logBusinessEvent("tool.start", {
        tool: "SubTask",
        task,
        context_count: contextMessages.length,
        allowed_tools: allowedTools,
      });
      try {
        const filteredToolNames = Array.from(new Set(allowedTools)).filter((name) => name in toolRegistry);
        if (filteredToolNames.length === 0) {
          return "SubTask 执行失败: allowedTools 无有效工具";
        }

        const subTools: Array<Tool<unknown>> = filteredToolNames.map((name) => toolRegistry[name]);
        const contextBlock =
          contextMessages.length > 0
            ? contextMessages.map((msg, idx) => `context[${idx + 1}]: ${msg}`).join("\n")
            : "context: (empty)";

        const subInput = `${contextBlock}\n\nsub_task: ${task}`;
        const subAgent = new Agent({
          name: "SubTaskAgent",
          instructions:
            "你是一次性子智能体。你只可使用当前输入里的 context 与 sub_task，不要假设主会话历史。优先调用工具获取事实。输出 3-6 行摘要，包含：做了什么、关键信息、结论。",
          model,
          tools: subTools,
        });

        const subRunner = new Runner({
          groupId: `${activeSessionId()}:sub`,
          traceMetadata: {
            session_id: activeSessionId(),
            req_id: activeReqId(),
            role: "sub_agent",
          },
        });

        const subResult = await subRunner.run(subAgent, subInput);
        const summary = cutText(String(subResult.finalOutput ?? ""), 1200);
        await logBusinessEvent("tool.success", {
          tool: "SubTask",
          allowed_tools: filteredToolNames,
          summary_chars: summary.length,
        });
        return summary;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logBusinessEvent("tool.error", { tool: "SubTask", error: msg });
        return `SubTask 执行失败: ${msg}`;
      }
    },
  });
}
