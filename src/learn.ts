const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");
const { CliError, invariant } = require("./errors.ts") as typeof import("./errors");
const { parseMarkdownFile, stringifyMarkdownFile } = require("./frontmatter.ts") as typeof import("./frontmatter");
const {
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
  pointIdFromRelativePath,
  pointRelativePathFromId,
  readText,
  relativePosix,
  resolveGoalPath,
  todayDateString,
  writeText,
} = require("./utils.ts") as typeof import("./utils");
import type { GoalFrontmatter, LearningIndex, PointFrontmatter, PointIndexEntry, ReviewGrade, ReviewLogEvent } from "./types.ts";

const SCHEMA_VERSION = "1.0.0";
const TEMPLATE_SCHEMA_DIR = path.resolve(__dirname, "../templates/learnspace/schemas");

function goalFilePath(goalPath: string): string {
  return path.join(goalPath, "goal.md");
}

function pointsDirPath(goalPath: string): string {
  return path.join(goalPath, "points");
}

function learnDirPath(goalPath: string): string {
  return path.join(goalPath, ".learn");
}

function indexFilePath(goalPath: string): string {
  return path.join(learnDirPath(goalPath), "index.json");
}

function reviewLogFilePath(goalPath: string): string {
  return path.join(learnDirPath(goalPath), "review-log.jsonl");
}

function schemasDirPath(goalPath: string): string {
  return path.join(goalPath, "schemas");
}

function pointAbsolutePath(goalPath: string, pointId: string): string {
  return path.join(goalPath, pointRelativePathFromId(pointId));
}

function parseGoal(goalPath: string): { data: GoalFrontmatter; body: string } {
  const file = readText(goalFilePath(goalPath));
  return parseMarkdownFile<GoalFrontmatter>(file);
}

function readPointByPath(pointPath: string): { data: PointFrontmatter; body: string } {
  const file = readText(pointPath);
  return parseMarkdownFile<PointFrontmatter>(file);
}

function readPointById(goalPath: string, pointId: string): { data: PointFrontmatter; body: string; path: string } {
  const absolutePath = pointAbsolutePath(goalPath, pointId);
  invariant(fileExists(absolutePath), `point not found: ${pointId}`, 3);
  const parsed = readPointByPath(absolutePath);
  return { ...parsed, path: absolutePath };
}

function writePoint(pointPath: string, point: PointFrontmatter, body: string): void {
  writeText(pointPath, stringifyMarkdownFile(point, body));
}

function defaultGoalFrontmatter(goalId: string): GoalFrontmatter {
  const today = todayDateString();
  return {
    id: goalId,
    title: goalId,
    status: "active",
    focus: "TODO",
    summary: "TODO",
    startDate: today,
    targetDate: null,
    tags: [],
    createdAt: today,
    updatedAt: today,
  };
}

function defaultGoalBody(title: string): string {
  return `# ${title}

## Scope

TODO

## Non-Goals

TODO

## Strategy

TODO

## Milestones

TODO
`;
}

function defaultPointFrontmatter(pointRelativePath: string): PointFrontmatter {
  const today = todayDateString();
  const id = pointIdFromRelativePath(pointRelativePath);
  const lastSegment = id.split(".").at(-1) ?? id;
  return {
    id,
    title: lastSegment.replace(/-/g, " "),
    domain: domainFromPointRelativePath(pointRelativePath),
    type: "knowledge",
    level: "basic",
    tags: [],
    relate: [],
    estimatedMinutes: 30,
    status: "todo",
    mastery: 0,
    confidence: 0,
    lastStudiedAt: null,
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    lapseCount: 0,
    intervalDays: 0,
    ease: 2.5,
    createdAt: today,
    updatedAt: today,
  };
}

function defaultPointBody(title: string): string {
  return `# ${title}

## 1. Explain

### 1.1 一句话解释

TODO

### 1.2 核心概念

TODO

### 1.3 为什么重要

TODO

### 1.4 常见误区

- TODO

### 1.5 最小例子

TODO

---

## 2. Practice

### 2.1 基础练习

TODO

### 2.2 应用练习

TODO

### 2.3 迁移练习

TODO

### 2.4 我的练习结果

TODO

---

## 3. Questions

### Q1. TODO

我的回答：

> TODO

修正后的理解：

> TODO

掌握情况：

- [ ] 没懂
- [ ] 部分懂
- [ ] 基本懂
- [ ] 完全懂

---

## 4. Final Understanding

### 4.1 我现在如何理解这个知识点

TODO

### 4.2 我能不能讲给别人听

TODO

### 4.3 判断是否掌握

- [ ] 我能解释它是什么
- [ ] 我知道它解决什么问题
- [ ] 我能写出最小例子
- [ ] 我能完成练习
- [ ] 我能回答常见问题
- [ ] 我能讲给别人听

---

## 5. Review Notes

### 第 1 次复习

- 时间：
- 结果：again / hard / good / easy
- 遗忘点：
- 新理解：
`;
}

function copyCanonicalSchemas(goalPath: string): void {
  const targetDir = schemasDirPath(goalPath);
  ensureDir(targetDir);
  for (const fileName of fs.readdirSync(TEMPLATE_SCHEMA_DIR)) {
    fs.copyFileSync(path.join(TEMPLATE_SCHEMA_DIR, fileName), path.join(targetDir, fileName));
  }
}

function ensureGoalStructure(goalPath: string): void {
  ensureDir(goalPath);
  ensureDir(pointsDirPath(goalPath));
  ensureDir(learnDirPath(goalPath));
  ensureDir(schemasDirPath(goalPath));
  if (!fileExists(reviewLogFilePath(goalPath))) {
    writeText(reviewLogFilePath(goalPath), "");
  }
}

function indexEntryFromPoint(goalPath: string, absolutePath: string, point: PointFrontmatter): PointIndexEntry {
  return {
    id: point.id,
    title: point.title,
    path: relativePosix(goalPath, absolutePath),
    domain: point.domain,
    type: point.type,
    level: point.level,
    status: point.status,
    mastery: point.mastery,
    confidence: point.confidence,
    nextReviewAt: point.nextReviewAt,
    tags: point.tags,
    relate: point.relate,
  };
}

function scanPoints(goalPath: string): Array<{ path: string; relativePath: string; data: PointFrontmatter; body: string }> {
  const files = listMarkdownFiles(pointsDirPath(goalPath));
  return files.map((filePath) => {
    const parsed = readPointByPath(filePath);
    return {
      path: filePath,
      relativePath: relativePosix(goalPath, filePath),
      data: parsed.data,
      body: parsed.body,
    };
  });
}

function rebuildIndex(goalArg: string): LearningIndex {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  ensureGoalStructure(goalPath);
  const goal = parseGoal(goalPath);
  const points = scanPoints(goalPath).map((point) => indexEntryFromPoint(goalPath, point.path, point.data));
  const index: LearningIndex = {
    schemaVersion: SCHEMA_VERSION,
    goalId: goal.data.id,
    generatedAt: nowIsoString(),
    points,
  };
  writeText(indexFilePath(goalPath), `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

function saveAndReindex(goalPath: string, pointPath: string, point: PointFrontmatter, body: string): void {
  writePoint(pointPath, point, body);
  rebuildIndex(goalPath);
}

function goalInit(goalArg: string): void {
  const goalPath = resolveGoalPath(goalArg);
  invariant(!fileExists(goalPath), `goal already exists: ${goalArg}`, 4);
  ensureGoalStructure(goalPath);
  const frontmatter = defaultGoalFrontmatter(path.basename(goalPath));
  writeText(goalFilePath(goalPath), stringifyMarkdownFile(frontmatter, defaultGoalBody(frontmatter.title)));
  copyCanonicalSchemas(goalPath);
  rebuildIndex(goalArg);
  console.log(`initialized goal at ${goalPath}`);
}

function goalShow(goalArg: string): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  const goal = parseGoal(goalPath);
  const points = scanPoints(goalPath);
  console.log(`${goal.data.title}`);
  console.log(`id: ${goal.data.id}`);
  console.log(`status: ${goal.data.status}`);
  console.log(`points: ${points.length}`);
}

function pointAdd(goalArg: string, pointPathArg: string): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  const relativePath = `points/${normalizePointInput(pointPathArg)}`;
  const absolutePath = path.join(goalPath, relativePath);
  invariant(!fileExists(absolutePath), `point already exists: ${relativePath}`, 4);
  ensureDir(path.dirname(absolutePath));
  const frontmatter = defaultPointFrontmatter(relativePath);
  writeText(absolutePath, stringifyMarkdownFile(frontmatter, defaultPointBody(frontmatter.title)));
  rebuildIndex(goalArg);
  console.log(frontmatter.id);
}

function pointList(goalArg: string, filters: { domain?: string; status?: string }): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  let points = scanPoints(goalPath);
  if (filters.domain) {
    points = points.filter((point) => point.data.domain === filters.domain);
  }
  if (filters.status) {
    points = points.filter((point) => point.data.status === filters.status);
  }
  for (const point of points) {
    console.log(`${point.data.id}\t${point.data.status}\t${point.data.mastery}\t${point.relativePath}`);
  }
}

function pointShow(goalArg: string, pointId: string): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  const point = readPointById(goalPath, pointId);
  console.log(`id: ${point.data.id}`);
  console.log(`title: ${point.data.title}`);
  console.log(`path: ${relativePosix(goalPath, point.path)}`);
  console.log(`status: ${point.data.status}`);
  console.log(`mastery: ${point.data.mastery}`);
  console.log(`nextReviewAt: ${point.data.nextReviewAt ?? ""}`);
}

function studyStart(goalArg: string, pointId: string): void {
  const goalPath = resolveGoalPath(goalArg);
  const point = readPointById(goalPath, pointId);
  if (point.data.status === "todo" || point.data.status === "paused") {
    point.data.status = "learning";
  }
  point.data.lastStudiedAt = nowIsoString();
  point.data.updatedAt = todayDateString();
  saveAndReindex(goalPath, point.path, point.data, point.body);
}

function studyDone(goalArg: string, pointId: string, mastery: number): void {
  const goalPath = resolveGoalPath(goalArg);
  const point = readPointById(goalPath, pointId);
  point.data.mastery = clamp(mastery, 0, 5);
  point.data.lastStudiedAt = nowIsoString();
  point.data.status = point.data.mastery >= 5 ? "mastered" : "learned";
  point.data.updatedAt = todayDateString();
  saveAndReindex(goalPath, point.path, point.data, point.body);
}

function reviewBootstrapInterval(point: PointFrontmatter, multiplier: number): number {
  const base = point.intervalDays > 0 ? point.intervalDays : 1;
  return Math.max(1, base * multiplier);
}

function reviewCheck(goalArg: string): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  const now = Date.now();
  const due = scanPoints(goalPath)
    .filter((point) => point.data.nextReviewAt && Date.parse(point.data.nextReviewAt) <= now)
    .filter((point) => !["todo", "mastered", "paused"].includes(point.data.status))
    .sort((a, b) => Date.parse(a.data.nextReviewAt ?? "") - Date.parse(b.data.nextReviewAt ?? ""));

  if (due.length === 0) {
    console.log("no points due");
    return;
  }

  console.log(`due points: ${due.length}`);
  for (const point of due) {
    console.log(`${point.data.id}\t${point.data.mastery}/5\t${point.data.nextReviewAt}`);
  }
}

function reviewDone(goalArg: string, pointId: string, grade: ReviewGrade, note?: string): void {
  const goalPath = resolveGoalPath(goalArg);
  const point = readPointById(goalPath, pointId);
  const reviewedAt = nowIsoString();
  const masteryBefore = point.data.mastery;
  const intervalDaysBefore = point.data.intervalDays;
  let intervalDaysAfter = intervalDaysBefore;
  let masteryAfter = masteryBefore;
  let nextReviewAt = reviewedAt;

  if (grade === "again") {
    masteryAfter = clamp(masteryBefore - 1, 0, 5);
    intervalDaysAfter = 0;
    point.data.lapseCount += 1;
    nextReviewAt = addMinutes(reviewedAt, 10);
  } else if (grade === "hard") {
    intervalDaysAfter = 1;
    nextReviewAt = addDays(reviewedAt, 1);
  } else if (grade === "good") {
    masteryAfter = clamp(masteryBefore + 1, 0, 5);
    intervalDaysAfter = reviewBootstrapInterval(point.data, 2);
    nextReviewAt = addDays(reviewedAt, intervalDaysAfter);
  } else if (grade === "easy") {
    masteryAfter = clamp(masteryBefore + 1, 0, 5);
    intervalDaysAfter = reviewBootstrapInterval(point.data, 3);
    nextReviewAt = addDays(reviewedAt, intervalDaysAfter);
  }

  point.data.mastery = masteryAfter;
  point.data.intervalDays = intervalDaysAfter;
  point.data.reviewCount += 1;
  point.data.lastReviewedAt = reviewedAt;
  point.data.nextReviewAt = nextReviewAt;
  point.data.status = masteryAfter >= 5 ? "mastered" : "reviewing";
  point.data.updatedAt = todayDateString();

  const event: ReviewLogEvent = {
    pointId: point.data.id,
    pointPath: relativePosix(goalPath, point.path),
    reviewedAt,
    grade,
    masteryBefore,
    masteryAfter,
    intervalDaysBefore,
    intervalDaysAfter,
    nextReviewAt,
    note,
  };

  fs.appendFileSync(reviewLogFilePath(goalPath), `${JSON.stringify(event)}\n`, "utf8");
  saveAndReindex(goalPath, point.path, point.data, point.body);
}

function validateGoalFrontmatter(goal: GoalFrontmatter): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(goal.id)) errors.push("goal.id is invalid");
  if (!goal.title) errors.push("goal.title is required");
  if (!["draft", "active", "paused", "completed", "archived"].includes(goal.status)) errors.push("goal.status is invalid");
  if (!Array.isArray(goal.tags)) errors.push("goal.tags must be an array");
  if (!isValidDateString(goal.startDate)) errors.push("goal.startDate must be YYYY-MM-DD or null");
  if (!isValidDateString(goal.targetDate)) errors.push("goal.targetDate must be YYYY-MM-DD or null");
  if (!isValidDateString(goal.createdAt)) errors.push("goal.createdAt must be YYYY-MM-DD");
  if (!isValidDateString(goal.updatedAt)) errors.push("goal.updatedAt must be YYYY-MM-DD");
  return errors;
}

function validatePoint(goalPath: string, pointPath: string, point: PointFrontmatter, seenIds: Set<string>): string[] {
  const errors: string[] = [];
  const relativePath = relativePosix(goalPath, pointPath);
  const expectedId = pointIdFromRelativePath(relativePath);
  const expectedDomain = domainFromPointRelativePath(relativePath);

  if (point.id !== expectedId) errors.push(`${relativePath}: id mismatch. expected=${expectedId} actual=${point.id}`);
  if (seenIds.has(point.id)) errors.push(`${relativePath}: duplicate id ${point.id}`);
  seenIds.add(point.id);
  if (point.domain !== expectedDomain) errors.push(`${relativePath}: domain mismatch. expected=${expectedDomain} actual=${point.domain}`);
  if (!["knowledge", "concept", "skill", "task", "project"].includes(point.type)) errors.push(`${relativePath}: invalid type`);
  if (!["basic", "intermediate", "advanced"].includes(point.level)) errors.push(`${relativePath}: invalid level`);
  if (!["todo", "learning", "learned", "reviewing", "mastered", "paused"].includes(point.status)) errors.push(`${relativePath}: invalid status`);
  if (!Number.isInteger(point.mastery) || point.mastery < 0 || point.mastery > 5) errors.push(`${relativePath}: mastery must be 0..5`);
  if (!Number.isInteger(point.confidence) || point.confidence < 0 || point.confidence > 100) errors.push(`${relativePath}: confidence must be 0..100`);
  if (!isValidDateTimeString(point.lastStudiedAt)) errors.push(`${relativePath}: invalid lastStudiedAt`);
  if (!isValidDateTimeString(point.lastReviewedAt)) errors.push(`${relativePath}: invalid lastReviewedAt`);
  if (!isValidDateTimeString(point.nextReviewAt)) errors.push(`${relativePath}: invalid nextReviewAt`);
  if (!isValidDateString(point.createdAt)) errors.push(`${relativePath}: invalid createdAt`);
  if (!isValidDateString(point.updatedAt)) errors.push(`${relativePath}: invalid updatedAt`);
  if (!Array.isArray(point.tags)) errors.push(`${relativePath}: tags must be an array`);
  if (!Array.isArray(point.relate)) errors.push(`${relativePath}: relate must be an array`);
  for (const relatePath of point.relate) {
    const targetPath = path.resolve(path.dirname(pointPath), relatePath);
    if (!fileExists(targetPath)) {
      errors.push(`${relativePath}: relate target missing: ${relatePath}`);
    }
  }
  return errors;
}

function validateReviewLog(goalPath: string): string[] {
  const filePath = reviewLogFilePath(goalPath);
  if (!fileExists(filePath)) {
    return [`missing review log: ${relativePosix(goalPath, filePath)}`];
  }

  const errors: string[] = [];
  const lines = readText(filePath).split("\n").filter(Boolean);
  lines.forEach((line, index) => {
    try {
      const event = JSON.parse(line) as ReviewLogEvent;
      if (!["again", "hard", "good", "easy"].includes(event.grade)) {
        errors.push(`review-log line ${index + 1}: invalid grade`);
      }
      if (!isValidDateTimeString(event.reviewedAt)) {
        errors.push(`review-log line ${index + 1}: invalid reviewedAt`);
      }
    } catch {
      errors.push(`review-log line ${index + 1}: invalid JSON`);
    }
  });
  return errors;
}

function validateIndex(goalPath: string, pointFiles: string[]): string[] {
  const filePath = indexFilePath(goalPath);
  if (!fileExists(filePath)) {
    return [`missing index: ${relativePosix(goalPath, filePath)}`];
  }

  const errors: string[] = [];

  try {
    const raw = readText(filePath);
    const index = JSON.parse(raw) as LearningIndex;
    if (index.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`index schemaVersion mismatch: expected ${SCHEMA_VERSION} actual ${index.schemaVersion}`);
    }
    if (!Array.isArray(index.points)) {
      errors.push("index points must be an array");
      return errors;
    }
    if (index.points.length !== pointFiles.length) {
      errors.push(`index point count mismatch: expected ${pointFiles.length} actual ${index.points.length}`);
    }
    const indexTime = Date.parse(index.generatedAt);
    if (Number.isNaN(indexTime)) {
      errors.push("index generatedAt is invalid");
      return errors;
    }
    for (const pointPath of pointFiles) {
      const pointMtime = fs.statSync(pointPath).mtimeMs;
      if (pointMtime > indexTime) {
        errors.push(`index is stale for ${relativePosix(goalPath, pointPath)}`);
      }
    }
  } catch {
    errors.push("index.json is invalid JSON");
  }

  return errors;
}

function validateGoal(goalArg: string): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  const goal = parseGoal(goalPath);
  const errors = validateGoalFrontmatter(goal.data);
  const seenIds = new Set<string>();
  const points = scanPoints(goalPath);

  for (const point of points) {
    errors.push(...validatePoint(goalPath, point.path, point.data, seenIds));
  }

  errors.push(...validateIndex(goalPath, points.map((point) => point.path)));
  errors.push(...validateReviewLog(goalPath));

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    throw new CliError(`validation failed with ${errors.length} error(s)`, 1);
  }

  console.log("ok");
}

function stats(goalArg: string): void {
  const goalPath = resolveGoalPath(goalArg);
  assertGoalExists(goalPath);
  const points = scanPoints(goalPath);
  const statusCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  let dueCount = 0;
  const now = Date.now();

  for (const point of points) {
    statusCounts.set(point.data.status, (statusCounts.get(point.data.status) ?? 0) + 1);
    domainCounts.set(point.data.domain, (domainCounts.get(point.data.domain) ?? 0) + 1);
    if (point.data.nextReviewAt && Date.parse(point.data.nextReviewAt) <= now) {
      dueCount += 1;
    }
  }

  console.log(`points: ${points.length}`);
  console.log(`due: ${dueCount}`);
  for (const [status, count] of [...statusCounts.entries()].sort()) {
    console.log(`status.${status}: ${count}`);
  }
  for (const [domain, count] of [...domainCounts.entries()].sort()) {
    console.log(`domain.${domain}: ${count}`);
  }
}

module.exports = {
  goalInit,
  goalShow,
  pointAdd,
  pointList,
  pointShow,
  rebuildIndex,
  reviewCheck,
  reviewDone,
  stats,
  studyDone,
  studyStart,
  validateGoal,
};
