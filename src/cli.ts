const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");

type Command = "init" | "check" | "index" | "new";

type Config = {
  ignore: string[];
  indexOutput: string;
};

type Frontmatter = {
  name: string;
  description: string;
  timestamp: string;
  kind: "simple" | "complex";
  related: string[];
};

type FileRecord = {
  absolutePath: string;
  relativePath: string;
  frontmatter?: Frontmatter;
  errors: ValidationError[];
};

type ValidationErrorCode =
  | "missing_frontmatter"
  | "missing_field"
  | "empty_description"
  | "invalid_timestamp"
  | "timestamp_mismatch"
  | "duplicate_name"
  | "invalid_kind"
  | "invalid_related"
  | "unknown_related"
  | "self_related"
  | "duplicate_related"
  | "related_not_bidirectional";

type ValidationError = {
  code: ValidationErrorCode;
  filePath: string;
  message: string;
};

const CONFIG_FILE = "mdtree.config.json";
const TIMESTAMP_TOLERANCE_MS = 1000;
const REQUIRED_FIELDS = ["name", "description", "timestamp", "kind", "related"] as const;
const VALID_KINDS = new Set(["simple", "complex"]);
const DEFAULT_CONFIG: Config = {
  ignore: ["**/node_modules/**", "**/.git/**", "**/index.md"],
  indexOutput: "./index.md",
};

type NewCommandArgs = {
  fileArg?: string;
  name?: string;
  description?: string;
  kind?: Frontmatter["kind"];
  related: string[];
  title?: string;
};

function main(): void {
  const [rawCommand, ...rest] = process.argv.slice(2);

  if (!rawCommand || rawCommand === "--help" || rawCommand === "-h") {
    printHelp();
    process.exit(0);
  }

  const command = rawCommand as Command;
  if (!["init", "check", "index", "new"].includes(command)) {
    fail(`Unknown command "${rawCommand}".\n${helpText()}`);
  }

  if (command === "init") {
    runInit();
    return;
  }

  const configLookup = findConfig(process.cwd());
  if (!configLookup) {
    fail(`Missing ${CONFIG_FILE}. Run "mdtree init" first.`);
  }

  const config = readConfig(configLookup.configPath);
  if (command === "new") {
    const args = parseNewCommandArgs(rest);
    if (!args.fileArg) {
      fail(`Missing file path.\n${helpText()}`);
    }
    runNew(path.resolve(process.cwd(), args.fileArg), args);
    return;
  }

  const parsed = parseCommandArgs(rest);
  if (!parsed.pathArg) {
    fail(`Missing path argument.\n${helpText()}`);
  }

  const scanRoot = path.resolve(process.cwd(), parsed.pathArg);
  if (!fs.existsSync(scanRoot)) {
    fail(`Path does not exist: ${scanRoot}`);
  }

  if (command === "check") {
    const result = runCheck(scanRoot, config);
    process.exit(result.errorCount > 0 ? 1 : 0);
  }

  const outputPath = parsed.outArg
    ? path.resolve(process.cwd(), parsed.outArg)
    : path.resolve(path.dirname(configLookup.configPath), config.indexOutput);
  const result = runIndex(scanRoot, config, outputPath);
  process.exit(result.errorCount > 0 ? 1 : 0);
}

function runInit(): void {
  const configPath = path.resolve(process.cwd(), CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    fail(`${CONFIG_FILE} already exists at ${configPath}`);
  }

  fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
  console.log(`Created ${configPath}`);
}

function runNew(filePath: string, args: NewCommandArgs): void {
  if (!filePath.endsWith(".md")) {
    fail(`New file must end with ".md". actual=${filePath}`);
  }

  if (fs.existsSync(filePath)) {
    fail(`File already exists: ${filePath}`);
  }

  const kind = args.kind ?? "simple";
  if (!VALID_KINDS.has(kind)) {
    fail(`"kind" must be "simple" or "complex". actual=${JSON.stringify(kind)}`);
  }

  const normalizedRelated = dedupeStrings(args.related.map((item) => item.trim()).filter(Boolean));
  const name = (args.name ?? path.basename(filePath, ".md")).trim();
  if (name.length === 0) {
    fail(`Could not derive a valid name for ${filePath}. Pass --name explicitly.`);
  }

  if (normalizedRelated.includes(name)) {
    fail(`"related" must not include the node itself. name=${JSON.stringify(name)}`);
  }

  const description = (args.description ?? "TODO: update description.").trim();
  const title = (args.title ?? name).trim();
  const timestamp = new Date().toISOString();
  const content = buildNewMarkdown({
    name,
    description,
    timestamp,
    kind,
    related: normalizedRelated,
    title,
  });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  const time = new Date(timestamp);
  fs.utimesSync(filePath, time, time);

  const createdRecord = validateFile(path.dirname(filePath), filePath);
  if (createdRecord.errors.length > 0) {
    printErrors(createdRecord.errors);
    fail(`Created file but validation failed: ${filePath}`);
  }

  console.log(`Created ${filePath}`);
}

function runCheck(scanRoot: string, config: Config): { errorCount: number } {
  const result = validateTree(scanRoot, config);

  if (result.errors.length === 0) {
    console.log(`OK: checked ${result.records.length} markdown files in ${scanRoot}`);
    return { errorCount: 0 };
  }

  printErrors(result.errors);
  console.log(`Found ${result.errors.length} error(s) across ${result.records.length} markdown files.`);
  return { errorCount: result.errors.length };
}

function runIndex(scanRoot: string, config: Config, outputPath: string): { errorCount: number } {
  const result = validateTree(scanRoot, config);
  const validRecords = result.records.filter((record) => record.errors.length === 0 && record.frontmatter);
  const indexContent = buildIndexMarkdown(scanRoot, validRecords as RequiredFrontmatterRecord[]);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, indexContent, "utf8");

  if (result.errors.length > 0) {
    printErrors(result.errors);
    console.log(
      `Wrote partial index to ${outputPath}. Included ${validRecords.length} valid file(s), skipped ${result.records.length - validRecords.length}.`
    );
    return { errorCount: result.errors.length };
  }

  console.log(`Wrote index to ${outputPath} with ${validRecords.length} file(s).`);
  return { errorCount: 0 };
}

function buildNewMarkdown(frontmatter: Frontmatter & { title: string }): string {
  const relatedBlock =
    frontmatter.related.length > 0
      ? ["related:", ...frontmatter.related.map((item) => `  - ${item}`)].join("\n")
      : "related: []";

  return [
    "---",
    `name: ${frontmatter.name}`,
    `description: ${frontmatter.description}`,
    `timestamp: ${frontmatter.timestamp}`,
    `kind: ${frontmatter.kind}`,
    relatedBlock,
    "---",
    "",
    `# ${frontmatter.title}`,
    "",
  ].join("\n");
}

type RequiredFrontmatterRecord = FileRecord & { frontmatter: Frontmatter };

function validateTree(scanRoot: string, config: Config): { records: FileRecord[]; errors: ValidationError[] } {
  const markdownFiles = collectMarkdownFiles(scanRoot, config.ignore);
  const records = markdownFiles.map((filePath) => validateFile(scanRoot, filePath));
  validateUniqueNames(records);
  validateRelatedLinks(records);
  const errors = records.flatMap((record) => record.errors);
  return { records, errors };
}

function validateFile(scanRoot: string, filePath: string): FileRecord {
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(scanRoot, absolutePath) || path.basename(absolutePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const errors: ValidationError[] = [];
  const frontmatterBlock = readFrontmatterBlock(content);

  if (!frontmatterBlock) {
    errors.push({
      code: "missing_frontmatter",
      filePath: absolutePath,
      message: `missing YAML frontmatter at the top of the file. required fields=${REQUIRED_FIELDS.join(
        ", "
      )}. example:\n${indent(exampleFrontmatter(), "  ")}`,
    });
    return { absolutePath, relativePath, errors };
  }

  const parsed = parseFrontmatter(frontmatterBlock);
  const name = readScalar(parsed, "name");
  const description = readScalar(parsed, "description");
  const timestamp = readScalar(parsed, "timestamp");
  const kind = readScalar(parsed, "kind");
  const related = readStringArray(parsed, "related");

  if (name === undefined || name.trim().length === 0) {
    errors.push({
      code: "missing_field",
      filePath: absolutePath,
      message: `missing required field "name". example:\n${indent(exampleFrontmatter(), "  ")}`,
    });
  }

  if (description === undefined) {
    errors.push({
      code: "missing_field",
      filePath: absolutePath,
      message: `missing required field "description". example:\n${indent(exampleFrontmatter(), "  ")}`,
    });
  } else if (description.trim().length === 0) {
    errors.push({
      code: "empty_description",
      filePath: absolutePath,
      message: `"description" must not be empty. expected a non-empty summary. example:\n${indent(
        exampleFrontmatter(),
        "  "
      )}`,
    });
  }

  if (timestamp === undefined || timestamp.trim().length === 0) {
    errors.push({
      code: "missing_field",
      filePath: absolutePath,
      message: `missing required field "timestamp". example:\n${indent(exampleFrontmatter(), "  ")}`,
    });
  }

  if (kind === undefined || kind.trim().length === 0) {
    errors.push({
      code: "missing_field",
      filePath: absolutePath,
      message: `missing required field "kind". expected one of: simple, complex. example:\n${indent(
        exampleFrontmatter(),
        "  "
      )}`,
    });
  } else if (!VALID_KINDS.has(kind)) {
    errors.push({
      code: "invalid_kind",
      filePath: absolutePath,
      message: `"kind" must be "simple" or "complex". actual=${JSON.stringify(kind)}. example:\n${indent(
        exampleFrontmatter(),
        "  "
      )}`,
    });
  }

  if (!parsed.has("related")) {
    errors.push({
      code: "missing_field",
      filePath: absolutePath,
      message: `missing required field "related". expected a YAML string array, which may be empty. example:\n${indent(
        exampleFrontmatter(),
        "  "
      )}`,
    });
  } else if (related === undefined) {
    errors.push({
      code: "invalid_related",
      filePath: absolutePath,
      message: `"related" must be a YAML string array. example:\n${indent(exampleFrontmatter(), "  ")}`,
    });
  } else {
    const seen = new Set<string>();
    for (const relatedName of related) {
      if (relatedName.trim().length === 0) {
        errors.push({
          code: "invalid_related",
          filePath: absolutePath,
          message: `"related" must contain non-empty names. example:\n${indent(exampleFrontmatter(), "  ")}`,
        });
        continue;
      }
      if (relatedName === name) {
        errors.push({
          code: "self_related",
          filePath: absolutePath,
          message: `"related" must not reference itself. name=${JSON.stringify(name)}`,
        });
      }
      if (seen.has(relatedName)) {
        errors.push({
          code: "duplicate_related",
          filePath: absolutePath,
          message: `"related" contains duplicate name ${JSON.stringify(relatedName)}`,
        });
      }
      seen.add(relatedName);
    }
  }

  let normalizedTimestamp: string | undefined;
  if (timestamp) {
    const parsedDate = new Date(timestamp);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== timestamp) {
      errors.push({
        code: "invalid_timestamp",
        filePath: absolutePath,
        message: `"timestamp" must be an exact ISO string. actual=${JSON.stringify(timestamp)}`,
      });
    } else {
      normalizedTimestamp = parsedDate.toISOString();
      const fileMtime = fs.statSync(absolutePath).mtime.getTime();
      const delta = Math.abs(parsedDate.getTime() - fileMtime);
      if (delta > TIMESTAMP_TOLERANCE_MS) {
        errors.push({
          code: "timestamp_mismatch",
          filePath: absolutePath,
          message: `"timestamp" does not match file mtime within ${TIMESTAMP_TOLERANCE_MS}ms. expected=${new Date(
            fileMtime
          ).toISOString()} actual=${normalizedTimestamp}`,
        });
      }
    }
  }

  const frontmatter =
    name &&
    name.trim().length > 0 &&
    description &&
    normalizedTimestamp &&
    kind &&
    VALID_KINDS.has(kind) &&
    related
      ? {
          name,
          description,
          timestamp: normalizedTimestamp,
          kind: kind as Frontmatter["kind"],
          related,
        }
      : undefined;

  return { absolutePath, relativePath, frontmatter, errors };
}

function validateUniqueNames(records: FileRecord[]): ValidationError[] {
  const buckets = new Map<string, FileRecord[]>();
  for (const record of records) {
    if (!record.frontmatter || record.errors.length > 0) {
      continue;
    }
    const existing = buckets.get(record.frontmatter.name) ?? [];
    existing.push(record);
    buckets.set(record.frontmatter.name, existing);
  }

  const errors: ValidationError[] = [];
  for (const [name, matches] of buckets.entries()) {
    if (matches.length < 2) {
      continue;
    }
    const listedPaths = matches.map((match) => match.absolutePath).join(", ");
    for (const match of matches) {
      match.errors.push({
        code: "duplicate_name",
        filePath: match.absolutePath,
        message: `"name" must be unique. duplicate=${JSON.stringify(name)} paths=${listedPaths}`,
      });
    }
    errors.push(...matches.map((match) => match.errors[match.errors.length - 1]));
  }

  return errors;
}

function validateRelatedLinks(records: FileRecord[]): ValidationError[] {
  const validRecords = records.filter((record): record is RequiredFrontmatterRecord => Boolean(record.frontmatter));
  const byName = new Map(validRecords.map((record) => [record.frontmatter.name, record] as const));
  const errors: ValidationError[] = [];

  for (const record of validRecords) {
    for (const relatedName of record.frontmatter.related) {
      const target = byName.get(relatedName);
      if (!target) {
        const error = {
          code: "unknown_related" as const,
          filePath: record.absolutePath,
          message: `"related" references unknown node ${JSON.stringify(relatedName)}`,
        };
        record.errors.push(error);
        errors.push(error);
        continue;
      }

      if (!target.frontmatter.related.includes(record.frontmatter.name)) {
        const error = {
          code: "related_not_bidirectional" as const,
          filePath: record.absolutePath,
          message: `"related" must be bidirectional. ${JSON.stringify(record.frontmatter.name)} references ${JSON.stringify(
            relatedName
          )}, but the reverse link is missing in ${target.absolutePath}`,
        };
        record.errors.push(error);
        errors.push(error);
      }
    }
  }

  return errors;
}

function buildIndexMarkdown(scanRoot: string, records: RequiredFrontmatterRecord[]): string {
  const rootNode: TreeNode = {
    name: path.resolve(scanRoot),
    fullPath: path.resolve(scanRoot),
    directories: new Map(),
    files: [],
  };

  for (const record of records.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    const segments = record.relativePath.split(path.sep);
    let current = rootNode;

    for (const segment of segments.slice(0, -1)) {
      const next = current.directories.get(segment);
      if (next) {
        current = next;
        continue;
      }
      const fullPath = path.join(current.fullPath, segment);
      const created: TreeNode = { name: segment, fullPath, directories: new Map(), files: [] };
      current.directories.set(segment, created);
      current = created;
    }

    current.files.push(record);
  }

  const lines = [`# Markdown Index`, ``, `Root: ${path.resolve(scanRoot)}`, ``];
  renderTreeNode(rootNode, lines, 0, true);
  return `${lines.join("\n")}\n`;
}

type TreeNode = {
  name: string;
  fullPath: string;
  directories: Map<string, TreeNode>;
  files: RequiredFrontmatterRecord[];
};

function renderTreeNode(node: TreeNode, lines: string[], depth: number, isRoot = false): void {
  const indent = "  ".repeat(depth);
  if (isRoot) {
    lines.push(`- ${node.fullPath}`);
  } else {
    lines.push(`${indent}- ${node.name}/`);
  }

  for (const directory of [...node.directories.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    renderTreeNode(directory, lines, depth + 1);
  }

  for (const file of node.files.sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name))) {
    const fileIndent = "  ".repeat(depth + 1);
    lines.push(`${fileIndent}- [${escapeMarkdown(file.frontmatter.name)}](${file.absolutePath})`);
    lines.push(`${fileIndent}  - kind: ${file.frontmatter.kind}`);
    lines.push(`${fileIndent}  - description: ${file.frontmatter.description}`);
    lines.push(`${fileIndent}  - timestamp: ${file.frontmatter.timestamp}`);
    lines.push(
      `${fileIndent}  - related: ${
        file.frontmatter.related.length > 0 ? file.frontmatter.related.join(", ") : "[]"
      }`
    );
  }
}

function collectMarkdownFiles(scanRoot: string, ignorePatterns: string[]): string[] {
  const files: string[] = [];

  walkDirectory(path.resolve(scanRoot), ignorePatterns, files);
  return files.sort((a, b) => a.localeCompare(b));
}

function walkDirectory(currentPath: string, ignorePatterns: string[], files: string[]): void {
  if (shouldIgnore(currentPath, ignorePatterns, true)) {
    return;
  }

  let stats: ReturnType<typeof fs.statSync>;
  try {
    stats = fs.statSync(currentPath);
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return;
    }
    throw error;
  }

  if (stats.isFile()) {
    if (currentPath.endsWith(".md") && !shouldIgnore(currentPath, ignorePatterns, false)) {
      files.push(currentPath);
    }
    return;
  }

  let entries: ReturnType<typeof fs.readdirSync>;
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true });
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(entryPath, ignorePatterns, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md") && !shouldIgnore(entryPath, ignorePatterns, false)) {
      files.push(entryPath);
    }
  }
}

function shouldIgnore(targetPath: string, patterns: string[], isDirectory: boolean): boolean {
  const normalized = targetPath.split(path.sep).join("/");
  const decorated = isDirectory ? `${normalized}/` : normalized;
  return patterns.some((pattern) => globToRegExp(pattern).test(decorated));
}

const globCache = new Map<string, RegExp>();

function globToRegExp(pattern: string): RegExp {
  const cached = globCache.get(pattern);
  if (cached) {
    return cached;
  }

  let source = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const next = pattern[i + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      i += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegExp(char);
  }
  source += "$";

  const regex = new RegExp(source);
  globCache.set(pattern, regex);
  return regex;
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function readFrontmatterBlock(content: string): string | undefined {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return undefined;
  }

  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return undefined;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex === -1) {
    return undefined;
  }

  return lines.slice(1, closingIndex).join("\n");
}

type FrontmatterValue = string | string[];

function parseFrontmatter(block: string): Map<string, FrontmatterValue> {
  const map = new Map<string, FrontmatterValue>();
  const lines = block.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const keyMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!keyMatch) {
      continue;
    }

    const [, key, rawValue] = keyMatch;
    if (rawValue.trim().length > 0) {
      map.set(key, normalizeYamlScalar(rawValue));
      continue;
    }

    const items: string[] = [];
    let cursor = i + 1;
    while (cursor < lines.length) {
      const itemLine = lines[cursor];
      if (/^\s*#/.test(itemLine)) {
        cursor += 1;
        continue;
      }
      const itemMatch = /^\s*-\s*(.*)$/.exec(itemLine);
      if (!itemMatch) {
        break;
      }
      items.push(normalizeYamlScalar(itemMatch[1]));
      cursor += 1;
    }

    map.set(key, items);
    i = cursor - 1;
  }
  return map;
}

function normalizeYamlScalar(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readScalar(map: Map<string, FrontmatterValue>, key: string): string | undefined {
  if (!map.has(key)) {
    return undefined;
  }
  const value = map.get(key);
  return typeof value === "string" ? value : undefined;
}

function readStringArray(map: Map<string, FrontmatterValue>, key: string): string[] | undefined {
  if (!map.has(key)) {
    return undefined;
  }
  const value = map.get(key);
  if (value === "[]") {
    return [];
  }
  return Array.isArray(value) ? value : undefined;
}

function parseCommandArgs(args: string[]): { pathArg?: string; outArg?: string } {
  let pathArg: string | undefined;
  let outArg: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      outArg = args[i + 1];
      i += 1;
      continue;
    }
    if (!pathArg) {
      pathArg = arg;
      continue;
    }
    fail(`Unexpected argument "${arg}".\n${helpText()}`);
  }

  return { pathArg, outArg };
}

function parseNewCommandArgs(args: string[]): NewCommandArgs {
  let fileArg: string | undefined;
  let name: string | undefined;
  let description: string | undefined;
  let kind: Frontmatter["kind"] | undefined;
  let title: string | undefined;
  const related: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--name") {
      name = requireFlagValue(arg, args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--description") {
      description = requireFlagValue(arg, args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--kind") {
      kind = requireFlagValue(arg, args[i + 1]) as Frontmatter["kind"];
      i += 1;
      continue;
    }
    if (arg === "--related") {
      related.push(...splitCsv(requireFlagValue(arg, args[i + 1])));
      i += 1;
      continue;
    }
    if (arg === "--title") {
      title = requireFlagValue(arg, args[i + 1]);
      i += 1;
      continue;
    }
    if (!fileArg) {
      fileArg = arg;
      continue;
    }
    fail(`Unexpected argument "${arg}".\n${helpText()}`);
  }

  return { fileArg, name, description, kind, related, title };
}

function findConfig(startDir: string): { configPath: string } | undefined {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, CONFIG_FILE);
    if (fs.existsSync(candidate)) {
      return { configPath: candidate };
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function readConfig(configPath: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`Failed to parse ${configPath}: ${(error as Error).message}`);
  }

  if (!isConfig(raw)) {
    fail(`Invalid ${configPath}. Expected {"ignore": string[], "indexOutput": string}.`);
  }

  return raw;
}

function isConfig(value: unknown): value is Config {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.ignore) &&
    candidate.ignore.every((item) => typeof item === "string") &&
    typeof candidate.indexOutput === "string"
  );
}

function printErrors(errors: ValidationError[]): void {
  for (const error of errors.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.code.localeCompare(b.code))) {
    console.error(`${error.filePath}: ${error.code}: ${error.message}`);
  }
}

function printHelp(): void {
  console.log(helpText());
}

function helpText(): string {
  return [
    "mdtree",
    "",
    "Usage:",
    "  mdtree init",
    "  mdtree new <file> [--name <name>] [--description <text>] [--kind <simple|complex>] [--related <a,b>] [--title <title>]",
    "  mdtree check <path>",
    "  mdtree index <path> [--out <path>]",
  ].join("\n");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\[\]])/g, "\\$1");
}

function isIgnorableFsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireFlagValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) {
    fail(`Missing value for ${flag}.`);
  }
  return value;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function exampleFrontmatter(): string {
  return [
    "---",
    "name: example-name",
    "description: Short summary of what this file is about.",
    "timestamp: 2026-07-08T10:30:00.000Z",
    "kind: simple",
    "related:",
    "  - another-node",
    "  - grouped-topic",
    "---",
  ].join("\n");
}

function indent(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

main();
