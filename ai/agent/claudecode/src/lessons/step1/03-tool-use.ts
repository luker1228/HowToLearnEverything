import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { cwd, stdin, stdout } from "node:process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

type UserMessage = {
  role: "user";
  content: string;
};

type AssistantTextBlock = {
  type: "text";
  text: string;
};

type ToolInputMap = {
  bash: {
    command: string;
  };
  read_file: {
    path: string;
    limit?: number;
  };
  write_file: {
    path: string;
    content: string;
  };
  edit_file: {
    path: string;
    old_text: string;
    new_text: string;
  };
  glob: {
    pattern: string;
  };
};

type ToolName = keyof ToolInputMap;

type AssistantToolUseBlock = {
  [Name in ToolName]: {
    type: "tool_use";
    id: string;
    name: Name;
    input: ToolInputMap[Name];
  };
}[ToolName];

type AssistantBlock = AssistantTextBlock | AssistantToolUseBlock;

type AssistantMessage = {
  role: "assistant";
  content: AssistantBlock[];
};

type ToolResultMessage = {
  role: "tool";
  toolUseId: string;
  content: string;
};

type Message = UserMessage | AssistantMessage | ToolResultMessage;

type ModelResponse = {
  stopReason: "tool_use" | "end_turn";
  content: AssistantBlock[];
};

type ToolContext = {
  workDir: string;
};

type ToolHandlers = {
  [Name in ToolName]: (input: ToolInputMap[Name], context: ToolContext) => string;
};

type ToolSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
};

type ToolDefinition<Name extends ToolName = ToolName> = {
  name: Name;
  description: string;
  input_schema: ToolSchema;
};

const WORKDIR = cwd();

function run_bash(command: string): string {
  const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some((pattern) => command.includes(pattern))) {
    return "Error: Dangerous command blocked";
  }

  const result = spawnSync(command, {
    cwd: WORKDIR,
    encoding: "utf8",
    shell: true,
    timeout: 120_000,
  });

  if (result.error) {
    return `Error: ${result.error.message}`;
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return output ? output.slice(0, 50_000) : "(no output)";
}

function safePath(userPath: string): string {
  const absolutePath = resolve(WORKDIR, userPath);
  const relativePath = relative(WORKDIR, absolutePath);

  if (relativePath === "" || relativePath === ".") {
    return absolutePath;
  }

  if (relativePath.startsWith("..") || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes workspace: ${userPath}`);
  }

  return absolutePath;
}

function run_read(path: string, limit: number | null = null): string {
  try {
    const lines = readFileSync(safePath(path), "utf8").split(/\r?\n/);
    if (limit !== null && limit < lines.length) {
      return `${lines.slice(0, limit).join("\n")}\n... (${lines.length - limit} more lines)`;
    }

    return lines.join("\n");
  } catch (error: unknown) {
    return error instanceof Error ? `Error: ${error.message}` : "Error: unknown";
  }
}

function run_write(path: string, content: string): string {
  try {
    const filePath = safePath(path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");
    return `Wrote ${content.length} bytes to ${path}`;
  } catch (error: unknown) {
    return error instanceof Error ? `Error: ${error.message}` : "Error: unknown";
  }
}

function run_edit(path: string, old_text: string, new_text: string): string {
  try {
    const filePath = safePath(path);
    const text = readFileSync(filePath, "utf8");
    if (!text.includes(old_text)) {
      return `Error: text not found in ${path}`;
    }

    writeFileSync(filePath, text.replace(old_text, new_text), "utf8");
    return `Edited ${path}`;
  } catch (error: unknown) {
    return error instanceof Error ? `Error: ${error.message}` : "Error: unknown";
  }
}

function run_glob(pattern: string): string {
  try {
    const results: string[] = [];
    for (const match of globSearch(WORKDIR, pattern)) {
      const relativePath = relative(WORKDIR, match).split(sep).join("/");
      results.push(relativePath);
    }

    return results.length > 0 ? results.join("\n") : "(no matches)";
  } catch (error: unknown) {
    return error instanceof Error ? `Error: ${error.message}` : "Error: unknown";
  }
}

const TOOLS = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, limit: { type: "integer" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace exact text in a file once.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
  {
    name: "glob",
    description: "Find files matching a glob pattern.",
    input_schema: {
      type: "object",
      properties: { pattern: { type: "string" } },
      required: ["pattern"],
    },
  },
] satisfies ReadonlyArray<ToolDefinition>;

const TOOL_HANDLERS = {
  bash: (input, _context) => run_bash(input.command),
  read_file: (input, _context) => run_read(input.path, input.limit ?? null),
  write_file: (input, _context) => run_write(input.path, input.content),
  edit_file: (input, _context) => run_edit(input.path, input.old_text, input.new_text),
  glob: (input, _context) => run_glob(input.pattern),
} satisfies ToolHandlers;

function globSearch(rootDir: string, pattern: string): string[] {
  const regex = globToRegExp(pattern);
  const matches: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (currentDir === undefined) {
      continue;
    }

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      }

      const relativePath = relative(rootDir, absolutePath).split(sep).join("/");
      if (!entry.isDirectory() && regex.test(relativePath)) {
        matches.push(absolutePath);
      }
    }
  }

  return matches.sort((left, right) =>
    relative(rootDir, left).localeCompare(relative(rootDir, right)),
  );
}

function globToRegExp(pattern: string): RegExp {
  let regex = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === undefined) {
      continue;
    }

    if (character === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          regex += "(?:.*/)?";
          index += 2;
        } else {
          regex += ".*";
          index += 1;
        }
      } else {
        regex += "[^/]*";
      }

      continue;
    }

    if (character === "?") {
      regex += "[^/]";
      continue;
    }

    if (/[$()*+.?[\\\]^{|}]/.test(character)) {
      regex += `\\${character}`;
      continue;
    }

    regex += character;
  }

  return new RegExp(`${regex}$`);
}

function renderAssistantText(blocks: AssistantBlock[]): string {
  return blocks
    .filter((block): block is AssistantTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function executeToolCall(block: AssistantToolUseBlock, context: ToolContext): ToolResultMessage {
  switch (block.name) {
    case "bash":
      return {
        role: "tool",
        toolUseId: block.id,
        content: TOOL_HANDLERS.bash(block.input, context),
      };
    case "read_file":
      return {
        role: "tool",
        toolUseId: block.id,
        content: TOOL_HANDLERS.read_file(block.input, context),
      };
    case "write_file":
      return {
        role: "tool",
        toolUseId: block.id,
        content: TOOL_HANDLERS.write_file(block.input, context),
      };
    case "edit_file":
      return {
        role: "tool",
        toolUseId: block.id,
        content: TOOL_HANDLERS.edit_file(block.input, context),
      };
    case "glob":
      return {
        role: "tool",
        toolUseId: block.id,
        content: TOOL_HANDLERS.glob(block.input, context),
      };
  }
}

function executeToolCalls(blocks: AssistantBlock[], context: ToolContext): ToolResultMessage[] {
  const results: ToolResultMessage[] = [];

  for (const block of blocks) {
    if (block.type === "tool_use") {
      results.push(executeToolCall(block, context));
    }
  }

  return results;
}

function findLastUserMessage(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return message.content;
    }
  }

  return "";
}

function getToolResult(messages: Message[], toolUseId: string): ToolResultMessage | undefined {
  return messages.find((message): message is ToolResultMessage => {
    return message.role === "tool" && message.toolUseId === toolUseId;
  });
}

function simulateModel(messages: Message[]): ModelResponse {
  const readResult = getToolResult(messages, "read-readme");
  const globResult = getToolResult(messages, "glob-markdown");
  const writeResult = getToolResult(messages, "write-summary");

  if (!readResult || !globResult) {
    return {
      stopReason: "tool_use",
      content: [
        {
          type: "text",
          text: "我先读 README.md，再列出当前目录下的 Markdown 文件。",
        },
        {
          type: "tool_use",
          id: "read-readme",
          name: "read_file",
          input: {
            path: "README.md",
          },
        },
        {
          type: "tool_use",
          id: "glob-markdown",
          name: "glob",
          input: {
            pattern: "**/*.md",
          },
        },
      ],
    };
  }

  if (!writeResult) {
    const summaryContent = [
      "# Tool Use Summary",
      "",
      "## README.md",
      readResult.content.trim(),
      "",
      "## Markdown files",
      globResult.content.trim(),
      "",
      "This file was created by the lesson 03 tool dispatch demo.",
    ].join("\n");

    return {
      stopReason: "tool_use",
      content: [
        {
          type: "text",
          text: "信息已经收集完了，现在把结果写成一个 summary 文件。",
        },
        {
          type: "tool_use",
          id: "write-summary",
          name: "write_file",
          input: {
            path: "tool-use-summary.md",
            content: summaryContent,
          },
        },
      ],
    };
  }

  return {
    stopReason: "end_turn",
    content: [
      {
        type: "text",
        text: `summary file ready: ${writeResult.content}`,
      },
    ],
  };
}

async function agentLoop(messages: Message[]): Promise<void> {
  const context: ToolContext = {
    workDir: WORKDIR,
  };

  while (true) {
    const response = simulateModel(messages);
    messages.push({
      role: "assistant",
      content: response.content,
    });

    const assistantText = renderAssistantText(response.content);
    if (assistantText) {
      console.log(assistantText);
    }

    if (response.stopReason !== "tool_use") {
      return;
    }

    const results = executeToolCalls(response.content, context);
    for (const result of results) {
      console.log(`> ${result.toolUseId}`);
      console.log(result.content.slice(0, 200));
      messages.push(result);
    }
  }
}

function printToolTable(): void {
  console.log("s02: Tool Use — 在 s01 基础上加了 4 个工具");
  console.log("工具表:");
  for (const tool of TOOLS) {
    console.log(`- ${tool.name}: ${tool.description}`);
  }
  console.log("");
}

async function runInteractive(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("输入问题，回车发送。输入 q 退出。\n");

  while (true) {
    const query = await rl.question("s02 >> ");
    if (query.trim().toLowerCase() === "q" || query.trim().toLowerCase() === "exit") {
      break;
    }

    const messages: Message[] = [
      {
        role: "user",
        content: query,
      },
    ];

    await agentLoop(messages);

    console.log("");
  }

  rl.close();
}

async function runDemo(): Promise<void> {
  const messages: Message[] = [
    {
      role: "user",
      content: "读取 README.md，看看有哪些 Markdown 文件，然后写一个 summary 文件。",
    },
  ];

  await agentLoop(messages);
}

export async function runLesson03() {
  printToolTable();
  console.log(`Workspace: ${WORKDIR}`);

  if (stdin.isTTY && stdout.isTTY) {
    await runInteractive();
    return;
  }

  await runDemo();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLesson03().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
