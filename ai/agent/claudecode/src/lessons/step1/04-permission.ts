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

type PermissionArgs = Record<string, unknown>;

type PermissionRule = {
  tools: ToolName[];
  check: (args: PermissionArgs) => boolean;
  message: string;
};

type PermissionDecision = "allow" | "deny";

const WORKDIR = cwd();
const NON_INTERACTIVE_DENY_MESSAGE = "Permission denied (non-interactive approval required).";

function run_bash(command: string): string {
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

function isOutsideWorkspacePath(userPath: string): boolean {
  const absolutePath = resolve(WORKDIR, userPath);
  const relativePath = relative(WORKDIR, absolutePath);
  return relativePath.startsWith("..") || relativePath.startsWith(`..${sep}`);
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

const DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"];

const PERMISSION_RULES: PermissionRule[] = [
  {
    tools: ["write_file", "edit_file"],
    check: (args) => {
      const path = getString(args, "path");
      return path === undefined ? false : isOutsideWorkspacePath(path);
    },
    message: "Writing outside workspace",
  },
  {
    tools: ["bash"],
    check: (args) => {
      const command = getString(args, "command");
      return (
        command === undefined
        ? false
        : ["rm ", "> /etc/", "chmod 777"].some((keyword) => command.includes(keyword))
      );
    },
    message: "Potentially destructive command",
  },
];

function getString(args: PermissionArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function checkDenyList(command: string): string | null {
  for (const pattern of DENY_LIST) {
    if (command.includes(pattern)) {
      return `Blocked: '${pattern}' is on the deny list`;
    }
  }

  return null;
}

function checkRules(toolName: ToolName, args: PermissionArgs): string | null {
  for (const rule of PERMISSION_RULES) {
    if (rule.tools.includes(toolName) && rule.check(args)) {
      return rule.message;
    }
  }

  return null;
}

async function askUser(toolName: ToolName, args: PermissionArgs, reason: string): Promise<PermissionDecision> {
  if (!stdin.isTTY || !stdout.isTTY) {
    console.log(`\n⚠ ${reason}`);
    console.log(`   Tool: ${toolName}(${JSON.stringify(args)})`);
    console.log(`   ${NON_INTERACTIVE_DENY_MESSAGE}`);
    return "deny";
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    console.log(`\n⚠ ${reason}`);
    console.log(`   Tool: ${toolName}(${JSON.stringify(args)})`);
    const answer = await rl.question("   Allow? [y/N] ");
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes" ? "allow" : "deny";
  } finally {
    rl.close();
  }
}

async function checkPermission(block: AssistantToolUseBlock): Promise<boolean> {
  if (block.name === "bash") {
    const reason = checkDenyList(block.input.command);
    if (reason) {
      console.log(`\n⛔ ${reason}`);
      return false;
    }
  }

  const ruleReason = checkRules(block.name, block.input as PermissionArgs);
  if (ruleReason) {
    const decision = await askUser(block.name, block.input as PermissionArgs, ruleReason);
    if (decision === "deny") {
      return false;
    }
  }

  return true;
}

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

async function executeToolCalls(blocks: AssistantBlock[], context: ToolContext): Promise<ToolResultMessage[]> {
  const results: ToolResultMessage[] = [];

  for (const block of blocks) {
    if (block.type !== "tool_use") {
      continue;
    }

    const allowed = await checkPermission(block);
    if (!allowed) {
      results.push({
        role: "tool",
        toolUseId: block.id,
        content: "Permission denied.",
      });
      continue;
    }

    const result = executeToolCall(block, context);
    results.push(result);
  }

  return results;
}

function getToolResult(messages: Message[], toolUseId: string): ToolResultMessage | undefined {
  return messages.find((message): message is ToolResultMessage => {
    return message.role === "tool" && message.toolUseId === toolUseId;
  });
}

function simulateModel(messages: Message[]): ModelResponse {
  const deniedDanger = getToolResult(messages, "danger-bash");
  const deniedApproval = getToolResult(messages, "approval-bash");
  const pwdResult = getToolResult(messages, "pwd-bash");

  if (!deniedDanger || !deniedApproval || !pwdResult) {
    return {
      stopReason: "tool_use",
      content: [
        {
          type: "text",
          text: "我先试三个动作：一个安全的 pwd、一个会被硬拒绝的危险命令、一个需要审批的命令。",
        },
        {
          type: "tool_use",
          id: "pwd-bash",
          name: "bash",
          input: {
            command: "pwd",
          },
        },
        {
          type: "tool_use",
          id: "danger-bash",
          name: "bash",
          input: {
            command: "rm -rf /",
          },
        },
        {
          type: "tool_use",
          id: "approval-bash",
          name: "bash",
          input: {
            command: "chmod 777 README.md",
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
        text: [
          "权限演示结束。",
          `pwd => ${pwdResult.content}`,
          `danger => ${deniedDanger.content}`,
          `approval => ${deniedApproval.content}`,
        ].join("\n"),
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

    const results = await executeToolCalls(response.content, context);
    for (const result of results) {
      console.log(`> ${result.toolUseId}`);
      console.log(result.content.slice(0, 200));
      messages.push(result);
    }
  }
}

function printToolTable(): void {
  console.log("s03: Permission");
  console.log("工具表:");
  for (const tool of TOOLS) {
    console.log(`- ${tool.name}: ${tool.description}`);
  }
  console.log("");
}

async function runDemo(): Promise<void> {
  const messages: Message[] = [
    {
      role: "user",
      content: "演示权限系统。",
    },
  ];

  await agentLoop(messages);
}

async function runInteractive(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("输入问题，回车发送。输入 q 退出。\n");

  while (true) {
    const query = await rl.question("s03 >> ");
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

export async function runLesson04() {
  printToolTable();
  console.log(`Workspace: ${WORKDIR}`);

  if (stdin.isTTY && stdout.isTTY) {
    await runInteractive();
    return;
  }

  await runDemo();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLesson04().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
