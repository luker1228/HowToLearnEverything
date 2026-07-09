const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");
const { CliError, invariant } = require("./errors.ts") as typeof import("./errors");

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function addMinutes(isoString: string, minutes: number): string {
  return new Date(Date.parse(isoString) + minutes * 60 * 1000).toISOString();
}

function addDays(isoString: string, days: number): string {
  return new Date(Date.parse(isoString) + days * 24 * 60 * 60 * 1000).toISOString();
}

function ensureDir(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, "utf8");
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function listMarkdownFiles(rootPath: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function relativePosix(fromPath: string, toPath: string): string {
  return path.relative(fromPath, toPath).split(path.sep).join("/");
}

function normalizePointInput(pointPathArg: string): string {
  const normalized = pointPathArg.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return normalized.endsWith(".md") ? normalized : `${normalized}.md`;
}

function pointIdFromRelativePath(pointRelativePath: string): string {
  invariant(pointRelativePath.startsWith("points/"), `point path must start with points/: ${pointRelativePath}`, 2);
  return pointRelativePath.slice("points/".length, -".md".length).replace(/\//g, ".");
}

function pointRelativePathFromId(pointId: string): string {
  return `points/${pointId.replace(/\./g, "/")}.md`;
}

function domainFromPointRelativePath(pointRelativePath: string): string {
  const segments = pointRelativePath.split("/");
  invariant(segments.length >= 3, `invalid point path: ${pointRelativePath}`, 2);
  return segments[1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new CliError(`${label} must be an integer`, 2);
  }
  return parsed;
}

function resolveGoalPath(goalArg: string): string {
  return path.resolve(process.cwd(), goalArg);
}

function assertGoalExists(goalPath: string): void {
  invariant(fileExists(goalPath), `goal not found: ${goalPath}`, 3);
  invariant(fileExists(path.join(goalPath, "goal.md")), `goal.md not found in ${goalPath}`, 3);
}

function isValidDateString(value: string | null): boolean {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidDateTimeString(value: string | null): boolean {
  return value === null || !Number.isNaN(Date.parse(value));
}

module.exports = {
  addDays,
  addMinutes,
  assertGoalExists,
  clamp,
  domainFromPointRelativePath,
  ensureDir,
  fileExists,
  isValidDateString,
  isValidDateTimeString,
  listMarkdownFiles,
  normalizePointInput,
  nowIsoString,
  parseInteger,
  pointIdFromRelativePath,
  pointRelativePathFromId,
  readText,
  relativePosix,
  resolveGoalPath,
  todayDateString,
  writeText,
};
