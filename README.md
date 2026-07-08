# Learning Point Spec

This repository now defines a breaking v2 standard for learning goals and knowledge points.

The model is strict:

```txt
point.md is the source of truth
frontmatter stores structured state
.learn/index.json is a rebuildable snapshot
.learn/review-log.jsonl is an append-only event log
CLI is the only write entrypoint
JSON Schema is the quality boundary
```

Old `mdtree goal` conventions such as `goals/<slug>/index.md` plus `updates.md` are replaced by the new goal-folder model.

## Core Layout

One learning goal maps to one folder.
One knowledge point maps to one Markdown file.

```txt
learnspace/
  frontend-for-backend/
    goal.md
    points/
      html/
        semantic/
          article-aside.md
          main-section.md
        document/
          basic.md
      css/
        layout/
          flex.md
          grid.md
      react/
        component/
          props.md
          state.md
    .learn/
      index.json
      review-log.jsonl
    schemas/
      goal.schema.json
      point.schema.json
      index.schema.json
      review-log.schema.json
```

## Source of Truth

- `points/**/*.md` is the only primary data store for knowledge points.
- `goal.md` stores goal-level intent, scope, and learning strategy.
- `.learn/index.json` is a generated cache and may be deleted and rebuilt.
- `.learn/review-log.jsonl` is append-only and never rewrites old review events.
- No standalone `progress.json` is allowed.

## Point ID Contract

Point IDs are derived from file paths.

```txt
points/html/semantic/article-aside.md
=> html.semantic.article-aside
```

Rules:

```txt
remove the leading points/
remove the trailing .md
replace / with .
```

Examples:

```txt
points/css/layout/flex.md
=> css.layout.flex

points/react/component/props.md
=> react.component.props
```

The CLI must generate the ID automatically when creating a point.

## Point File Contract

Every point file uses `YAML frontmatter + Markdown body`.

Frontmatter is machine-owned state.
The Markdown body is human-owned learning content.

```md
---
id: html.semantic.article-aside
title: article 与 aside 的区别
domain: html
type: knowledge
level: basic
tags:
  - html
  - semantic
  - layout
relate: []
estimatedMinutes: 30

status: todo
mastery: 0
confidence: 0
lastStudiedAt:
lastReviewedAt:
nextReviewAt:
reviewCount: 0
lapseCount: 0
intervalDays: 0
ease: 2.5

createdAt: 2026-07-09
updatedAt: 2026-07-09
---

# article 与 aside 的区别

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
```

## Goal File Contract

`goal.md` is a Markdown document with strict frontmatter and freeform body text.

Recommended frontmatter:

```yaml
---
id: frontend-for-backend
title: Frontend for Backend
status: active
focus: 为 BFF 方向建立可复用的知识点体系
summary: 通过 point.md + review workflow 形成长期学习闭环
startDate: 2026-07-09
targetDate:
tags:
  - backend
  - frontend
  - architecture
createdAt: 2026-07-09
updatedAt: 2026-07-09
---
```

The body should describe:

- goal scope
- non-goals
- learning strategy
- milestone rhythm
- review policy exceptions

## Frontmatter Fields

### Point Definition Fields

| Field | Meaning |
| --- | --- |
| `id` | Unique point ID derived from path |
| `title` | Human-readable title |
| `domain` | Usually the first path segment under `points/` |
| `type` | Point type |
| `level` | Difficulty level |
| `tags` | Search and grouping tags |
| `relate` | Related point file paths |
| `estimatedMinutes` | Expected learning time |

### Point State Fields

| Field | Meaning |
| --- | --- |
| `status` | Current learning status |
| `mastery` | Objective mastery from `0` to `5` |
| `confidence` | Subjective confidence from `0` to `100` |
| `lastStudiedAt` | Last study timestamp |
| `lastReviewedAt` | Last review timestamp |
| `nextReviewAt` | Next scheduled review timestamp |
| `reviewCount` | Review count |
| `lapseCount` | Forgetting count |
| `intervalDays` | Current review interval |
| `ease` | Scheduling difficulty factor |

### Maintenance Fields

| Field | Meaning |
| --- | --- |
| `createdAt` | File creation date |
| `updatedAt` | Last metadata update date |

## Strong Conventions

### Time Format

- `lastStudiedAt`, `lastReviewedAt`, `nextReviewAt` must use RFC3339 date-time.
- `createdAt`, `updatedAt`, `startDate`, `targetDate` must use `YYYY-MM-DD`.

Examples:

```txt
2026-07-09T12:00:00Z
2026-07-09
```

### Status Enum

```txt
todo
learning
learned
reviewing
mastered
paused
```

### Mastery Enum

```txt
0 = 未接触
1 = 听过概念
2 = 能复述
3 = 能做基础例子
4 = 能独立应用
5 = 能迁移、讲解、解决真实问题
```

### Relate Contract

Only `relate` is maintained.

Not allowed:

```yaml
parentId:
prerequisites: []
```

Allowed:

```yaml
relate:
  - ../document/basic.md
  - ./main-section.md
  - ../../css/layout/flex.md
```

Paths should be relative to the current point file.

## Review Workflow

### `learn review check`

The command scans all point files and returns points where:

```txt
nextReviewAt <= now
status not in [todo, mastered, paused]
```

Sort order:

```txt
nextReviewAt asc
```

### `learn review done`

Command:

```bash
learn review done <goal> <pointId> --grade again|hard|good|easy
```

Grade rules for v1:

```txt
again -> review after 10 minutes, mastery - 1, lapseCount + 1
hard  -> review after 1 day, mastery unchanged
good  -> intervalDays * 2, mastery + 1
easy  -> intervalDays * 3, mastery + 1
```

Boundary rules:

```txt
mastery min = 0
mastery max = 5
mastery >= 5 may auto-set status = mastered
intervalDays for first successful review should bootstrap from 1
```

## Index Contract

`.learn/index.json` is a generated snapshot, never the source of truth.

Example:

```json
{
  "schemaVersion": "1.0.0",
  "goalId": "frontend-for-backend",
  "generatedAt": "2026-07-09T12:00:00Z",
  "points": [
    {
      "id": "html.semantic.article-aside",
      "title": "article 与 aside 的区别",
      "path": "points/html/semantic/article-aside.md",
      "domain": "html",
      "type": "knowledge",
      "level": "basic",
      "status": "learning",
      "mastery": 2,
      "confidence": 60,
      "nextReviewAt": "2026-07-12T10:30:00Z",
      "tags": ["html", "semantic", "layout"],
      "relate": [
        "../document/basic.md",
        "./main-section.md"
      ]
    }
  ]
}
```

## Review Log Contract

`.learn/review-log.jsonl` is append-only.

Example line:

```json
{"pointId":"html.semantic.article-aside","pointPath":"points/html/semantic/article-aside.md","reviewedAt":"2026-07-09T12:00:00Z","grade":"good","masteryBefore":2,"masteryAfter":3,"intervalDaysBefore":1,"intervalDaysAfter":2,"nextReviewAt":"2026-07-11T12:00:00Z","note":"能解释概念，但还需要继续练习代码结构。"}
```

## Validation Rules

`learn validate <goal>` must at least check:

1. every `points/**/*.md` file has frontmatter
2. frontmatter conforms to `schemas/point.schema.json`
3. `point.id` matches the path-derived ID
4. point IDs are unique
5. `domain` equals the first path segment
6. `status` is valid
7. `mastery` is within `0..5`
8. `confidence` is within `0..100`
9. `nextReviewAt` is a valid date-time when present
10. every `relate` path resolves to a real `.md` file
11. `.learn/index.json` is missing or stale
12. every line in `.learn/review-log.jsonl` conforms to `schemas/review-log.schema.json`

## Doctor Rules

`learn doctor <goal>` may auto-fix:

1. missing `.learn/`
2. missing `index.json`
3. missing `review-log.jsonl`
4. missing `relate` to `[]`
5. missing `tags` to `[]`
6. missing `createdAt` or `updatedAt`
7. missing `domain` derived from path
8. stale `index.json` by rebuilding it

`learn doctor <goal>` must not auto-fix:

1. point ID changes
2. file moves
3. point deletion
4. `relate` target rewrites

These require explicit user confirmation.

## Deliverables In This Repo

This standard is split into three artifacts:

- root [README.md](/Users/luke/my_projects/how-to-learn-something-everyday/README.md) for the canonical model
- [docs/learn-command-spec.md](/Users/luke/my_projects/how-to-learn-something-everyday/docs/learn-command-spec.md) for CLI behavior
- [templates/learnspace/schemas](/Users/luke/my_projects/how-to-learn-something-everyday/templates/learnspace/schemas) for JSON Schema contracts

## Migration Stance

This is a breaking rewrite of the standard.

- legacy `mdtree goal` documentation is removed
- legacy `goals/<slug>/updates.md` is no longer part of the target model
- future CLI work should implement `learn` semantics, not extend the old goal workflow
