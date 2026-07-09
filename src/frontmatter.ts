const { CliError } = require("./errors.ts") as typeof import("./errors");

type Scalar = string | number | null;
type FrontmatterValue = Scalar | string[];
type FrontmatterRecord = Record<string, FrontmatterValue>;

type ParsedMarkdown<T extends FrontmatterRecord> = {
  data: T;
  body: string;
};

function parseScalar(rawValue: string): Scalar | "__EMPTY_ARRAY__" {
  const value = rawValue.trim();
  if (value === "") {
    return null;
  }
  if (value === "[]") {
    return "__EMPTY_ARRAY__";
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

function parseMarkdownFile<T extends FrontmatterRecord>(input: string): ParsedMarkdown<T> {
  const match = input.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new CliError("missing YAML frontmatter at the top of the markdown file", 5);
  }

  const [, rawFrontmatter, body] = match;
  const lines = rawFrontmatter.split("\n");
  const data: FrontmatterRecord = {};
  let currentArrayKey: string | null = null;
  let pendingEmptyKey: string | null = null;

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }

    const arrayItemMatch = line.match(/^\s*-\s+(.*)$/);
    if (arrayItemMatch) {
      if (pendingEmptyKey) {
        data[pendingEmptyKey] = [];
        currentArrayKey = pendingEmptyKey;
        pendingEmptyKey = null;
      }
      if (!currentArrayKey) {
        throw new CliError(`invalid frontmatter array item: ${line}`, 5);
      }
      const currentValue = data[currentArrayKey];
      if (!Array.isArray(currentValue)) {
        throw new CliError(`frontmatter key is not an array: ${currentArrayKey}`, 5);
      }
      currentValue.push(arrayItemMatch[1].trim());
      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9]+):(?:\s(.*))?$/);
    if (!keyValueMatch) {
      throw new CliError(`invalid frontmatter line: ${line}`, 5);
    }

    currentArrayKey = null;
    pendingEmptyKey = null;

    const [, key, rawValue = ""] = keyValueMatch;
    const parsed = parseScalar(rawValue);
    if (parsed === "__EMPTY_ARRAY__") {
      data[key] = [];
      continue;
    }

    if (parsed === null && rawValue === "") {
      data[key] = null;
      pendingEmptyKey = key;
      continue;
    }

    data[key] = parsed;
  }

  return { data: data as T, body };
}

function stringifyScalar(value: Scalar): string {
  if (value === null) {
    return "";
  }
  return String(value);
}

function stringifyMarkdownFile<T extends FrontmatterRecord>(data: T, body: string): string {
  const lines: string[] = ["---"];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
      continue;
    }
    lines.push(`${key}: ${stringifyScalar(value)}`);
  }

  lines.push("---", "");
  const normalizedBody = body.replace(/^\n+/, "");
  return `${lines.join("\n")}${normalizedBody}`;
}

module.exports = { parseMarkdownFile, stringifyMarkdownFile };
