# Lesson 01 Notes

## 显式注解

先写清楚数据形状，再让代码围绕这个形状运行。

### 最佳实践代码

```ts
type UserMessage = {
  role: "user";
  content: string;
};

type AssistantTextBlock = {
  type: "text";
  text: string;
};

type AssistantToolUseBlock = {
  type: "tool_use";
  id: string;
  name: "bash";
  input: {
    command: string;
  };
};

type AssistantBlock = AssistantTextBlock | AssistantToolUseBlock;

const blocks: AssistantBlock[] = [
  { type: "text", text: "hello" },
  {
    type: "tool_use",
    id: "1",
    name: "bash",
    input: { command: "pwd" },
  },
];
```

### 最佳实践

- 先显式注解数据形状，再让代码围绕这个形状运行。
- 对能明确命名的数据结构，优先写出具体类型。
- 避免先用宽泛对象过渡，再靠后续代码猜字段。

## Union

同一个位置可以容纳多种不同形状的数据。

### 最佳实践代码

```ts
type AssistantTextBlock = {
  type: "text";
  text: string;
};

type AssistantToolUseBlock = {
  type: "tool_use";
  id: string;
  name: "bash";
  input: {
    command: string;
  };
};

type AssistantBlock = AssistantTextBlock | AssistantToolUseBlock;

const blocks: AssistantBlock[] = [
  { type: "text", text: "hello" },
  {
    type: "tool_use",
    id: "1",
    name: "bash",
    input: { command: "pwd" },
  },
];
```

### 最佳实践

- 对同一位置可能出现的不同对象，用 union 表达。
- 不要把不同形状的对象硬塞进一个宽泛接口里。
- 让 union 对应真实的运行时分支，而不是抽象概念。

## 可区分联合

用 `type` 字段做 narrowing，明确分支处理。

### 最佳实践代码

```ts
function handleBlock(block: AssistantBlock) {
  if (block.type === "text") {
    return block.text;
  }

  return block.input.command;
}
```

### 最佳实践

- 不要把这些值先写成宽泛对象，后面再靠猜字段补救。
- 对不同分支，用 `type` 字段做 narrowing。
- 先判断分支，再访问分支专属字段。

## Lesson 03 预告

`s02 Tool Use` 的关键点不是改 `while` 循环，而是把工具能力注册到分发表里。

### 最佳实践代码

```ts
type ToolInputMap = {
  bash: { command: string };
  read_file: { path: string };
};

type ToolName = keyof ToolInputMap;

type ToolHandlers = {
  [Name in ToolName]: (input: ToolInputMap[Name]) => string;
};

const handlers = {
  bash(input) {
    return `run ${input.command}`;
  },
  read_file(input) {
    return `read ${input.path}`;
  },
} satisfies ToolHandlers;
```

### 最佳实践

- 工具名和输入形状要绑定在同一个类型系统里。
- 新增工具时，优先加到分发表，而不是把 `if/else` 越堆越多。
- 让运行时做真实执行，让 TypeScript 约束数据结构。

## Lesson 04 预告

`s03 Permission` 的核心不是“再加一个工具”，而是“在工具执行前插入权限管线”。

### 最佳实践代码

```ts
type PermissionDecision = "allow" | "deny";

type PermissionRule = {
  tools: ToolName[];
  check: (args: Record<string, unknown>) => boolean;
  message: string;
};

async function checkPermission(block: AssistantToolUseBlock): Promise<boolean> {
  if (block.name === "bash" && block.input.command.includes("rm -rf /")) {
    return false;
  }

  return true;
}
```

### 最佳实践

- 权限要放在执行前，不要放在执行后。
- `bash` 这种大权限工具，要先做硬拒绝，再做规则匹配，再做用户确认。
- TypeScript 负责把权限管线的结构写清楚，运行时负责真正拦截危险动作。
