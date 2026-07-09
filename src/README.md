# Learn CLI Usage

This directory contains the runtime implementation of the `learn` CLI.

Current entrypoints:

- `../bin/learn`
- `./cli.ts`

## Run

From the repository root:

```bash
./bin/learn --help
```

Or run the TypeScript entry directly with Node.js 22:

```bash
node --no-warnings --experimental-strip-types src/cli.ts --help
```

## Supported Commands

### Goal

```bash
./bin/learn goal init <goal-path>
./bin/learn goal show <goal-path>
```

Example:

```bash
./bin/learn goal init /private/tmp/frontend-for-backend
./bin/learn goal show /private/tmp/frontend-for-backend
```

`goal init` creates:

```txt
<goal-path>/
  goal.md
  points/
  .learn/
    index.json
    review-log.jsonl
  schemas/
    goal.schema.json
    point.schema.json
    index.schema.json
    review-log.schema.json
```

### Point

```bash
./bin/learn point add <goal-path> <point-path>
./bin/learn point list <goal-path> [--domain <domain>] [--status <status>]
./bin/learn point show <goal-path> <pointId>
```

Example:

```bash
./bin/learn point add /private/tmp/frontend-for-backend html/semantic/article-aside
./bin/learn point list /private/tmp/frontend-for-backend
./bin/learn point show /private/tmp/frontend-for-backend html.semantic.article-aside
```

ID derivation rule:

```txt
points/html/semantic/article-aside.md
=> html.semantic.article-aside
```

### Study

```bash
./bin/learn study start <goal-path> <pointId>
./bin/learn study done <goal-path> <pointId> --mastery <0-5>
```

Example:

```bash
./bin/learn study start /private/tmp/frontend-for-backend html.semantic.article-aside
./bin/learn study done /private/tmp/frontend-for-backend html.semantic.article-aside --mastery 2
```

### Review

```bash
./bin/learn review check <goal-path>
./bin/learn review done <goal-path> <pointId> --grade again|hard|good|easy [--note <text>]
```

Example:

```bash
./bin/learn review check /private/tmp/frontend-for-backend
./bin/learn review done /private/tmp/frontend-for-backend html.semantic.article-aside --grade good --note "能复述概念"
```

Current scheduling rules:

```txt
again -> 10 minutes later, mastery - 1, lapseCount + 1
hard  -> 1 day later, mastery unchanged
good  -> intervalDays * 2, mastery + 1
easy  -> intervalDays * 3, mastery + 1
```

If `intervalDays` is `0`, successful reviews bootstrap from `1`.

### Index / Validate / Stats

```bash
./bin/learn index rebuild <goal-path>
./bin/learn validate <goal-path>
./bin/learn stats <goal-path>
```

Example:

```bash
./bin/learn index rebuild /private/tmp/frontend-for-backend
./bin/learn validate /private/tmp/frontend-for-backend
./bin/learn stats /private/tmp/frontend-for-backend
```

## Minimal Workflow

```bash
./bin/learn goal init /private/tmp/frontend-for-backend
./bin/learn point add /private/tmp/frontend-for-backend html/semantic/article-aside
./bin/learn study start /private/tmp/frontend-for-backend html.semantic.article-aside
./bin/learn study done /private/tmp/frontend-for-backend html.semantic.article-aside --mastery 2
./bin/learn review done /private/tmp/frontend-for-backend html.semantic.article-aside --grade good
./bin/learn validate /private/tmp/frontend-for-backend
./bin/learn stats /private/tmp/frontend-for-backend
```

## Implementation Notes

- The CLI is intentionally zero-dependency at runtime.
- Frontmatter parsing and writing lives in [frontmatter.ts](/Users/luke/my_projects/how-to-learn-something-everyday/src/frontmatter.ts).
- Command routing lives in [cli.ts](/Users/luke/my_projects/how-to-learn-something-everyday/src/cli.ts).
- Goal and point operations live in [learn.ts](/Users/luke/my_projects/how-to-learn-something-everyday/src/learn.ts).

## Current Scope

Implemented now:

- `goal init`
- `goal show`
- `point add`
- `point list`
- `point show`
- `study start`
- `study done`
- `review check`
- `review done`
- `index rebuild`
- `validate`
- `stats`

Not implemented yet:

- `point open`
- `point remove`
- `point rename`
- `study mastery`
- `study pause`
- `study resume`
- `review log`
- `relate list/add/remove/check`
- `index status`
- `stats weak`
- `doctor`
