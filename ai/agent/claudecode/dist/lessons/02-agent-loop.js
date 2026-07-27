import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
const tools = {
    bash(input) {
        if (input.command === "ls" || input.command === "ls -la") {
            return execFileSync("ls", ["-la"], {
                cwd: process.cwd(),
                encoding: "utf8",
            });
        }
        if (input.command === "pwd") {
            return `${process.cwd()}\n`;
        }
        return `unknown command: ${input.command}`;
    },
};
function loadLessonEnv() {
    const lessonDir = dirname(fileURLToPath(import.meta.url));
    const envPath = join(lessonDir, ".env");
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}
function toDeepSeekMessages(messages) {
    const systemMessage = {
        role: "system",
        content: [
            "You are teaching TypeScript through a minimal agent loop.",
            "Use the OpenAI tool-calling format.",
            "When you need the bash tool, call the function named bash.",
            "Use tool calls for directory inspection, then answer from the tool result.",
            "Keep the response concise.",
        ].join(" "),
    };
    const converted = messages.map((message) => {
        if (message.role === "user") {
            return {
                role: "user",
                content: message.content,
            };
        }
        if (message.role === "assistant") {
            const text = renderAssistantText(message.content);
            const toolCalls = message.content
                .filter((block) => block.type === "tool_use")
                .map((block) => ({
                id: block.id,
                type: "function",
                function: {
                    name: block.name,
                    arguments: JSON.stringify(block.input),
                },
            }));
            return {
                role: "assistant",
                content: text,
                ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
            };
        }
        return {
            role: "tool",
            tool_call_id: message.toolUseId,
            content: message.content,
        };
    });
    return [systemMessage, ...converted];
}
function parseAssistantMessage(message) {
    const blocks = [];
    if (message.content) {
        blocks.push({
            type: "text",
            text: message.content,
        });
    }
    for (const toolCall of message.tool_calls ?? []) {
        const args = JSON.parse(toolCall.function.arguments);
        if (typeof args !== "object" ||
            args === null ||
            !("command" in args) ||
            typeof args.command !== "string") {
            throw new Error("Model returned invalid tool arguments.");
        }
        blocks.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: {
                command: args.command,
            },
        });
    }
    return {
        stopReason: (message.tool_calls?.length ?? 0) > 0 ? "tool_use" : "end_turn",
        content: blocks,
    };
}
async function callDeepSeekModel(messages) {
    loadLessonEnv();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new Error("Missing DEEPSEEK_API_KEY. Set it in src/lessons/.env or export it before running.");
    }
    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
    const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: toDeepSeekMessages(messages),
            stream: false,
            temperature: 0,
        }),
    });
    if (!response.ok) {
        throw new Error(`DeepSeek request failed: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    const completion = payload;
    const message = completion.choices[0]?.message;
    if (!message) {
        throw new Error("DeepSeek response did not include a message.");
    }
    return parseAssistantMessage(message);
}
function executeToolCalls(blocks) {
    const results = [];
    for (const block of blocks) {
        if (block.type !== "tool_use") {
            continue;
        }
        const tool = tools[block.name];
        const output = tool(block.input);
        results.push({
            role: "tool",
            toolUseId: block.id,
            content: output,
        });
    }
    return results;
}
function renderAssistantText(blocks) {
    return blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
}
export async function runLesson02() {
    const userQuery = "帮我看看当前目录下有哪些文件。";
    const messages = [
        {
            role: "user",
            content: userQuery,
        },
    ];
    console.log("Lesson 02: s01 Agent Loop in TypeScript");
    console.log("Question:", userQuery);
    console.log("Goal: understand a minimal agent loop before adding more features.");
    while (true) {
        const response = await callDeepSeekModel(messages);
        const assistantMessage = {
            role: "assistant",
            content: response.content,
        };
        messages.push(assistantMessage);
        const assistantText = renderAssistantText(response.content);
        if (assistantText) {
            console.log("Assistant:", assistantText);
        }
        if (response.stopReason !== "tool_use") {
            break;
        }
        const toolResults = executeToolCalls(response.content);
        for (const result of toolResults) {
            messages.push(result);
            console.log(`Tool ${result.toolUseId}: ${result.content}`);
        }
    }
    console.log("");
    console.log("What to notice:");
    console.log("1. The loop is simple. Most complexity sits in data shapes.");
    console.log("2. TypeScript helps model message variants with unions.");
    console.log("3. The runtime still decides whether a command is valid.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runLesson02().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
