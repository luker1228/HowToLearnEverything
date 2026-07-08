# Learn CLI Command Spec

## Positioning

`learn` is the only supported write entrypoint for the Learning Point Spec.

- Markdown is the primary data store.
- Frontmatter is the structured state layer.
- JSON Schema is the validation contract.
- `.learn/index.json` is a generated read model.
- `.learn/review-log.jsonl` is an append-only event log.

## Command Surface

### Goal

```bash
learn goal init <goal>
learn goal show <goal>
```

Semantics:

- `goal init` creates `<goal>/goal.md`, `<goal>/points/`, `<goal>/.learn/`, and `<goal>/schemas/`
- `goal init` copies the canonical schemas into `<goal>/schemas/`
- `goal show` prints goal metadata and aggregate stats

### Point

```bash
learn point add <goal> <path>
learn point list <goal>
learn point show <goal> <pointId>
learn point open <goal> <pointId>
learn point remove <goal> <pointId>
learn point rename <goal> <oldPointId> <newPointId>
```

Semantics:

- `point add` creates `points/<path>.md` when `<path>` has no suffix
- `point add` derives `id`, `domain`, `createdAt`, and `updatedAt`
- `point list` supports filtering by `--domain`, `--status`, `--tag`, `--level`
- `point show` prints frontmatter summary plus file path
- `point open` resolves the file path for editor integration
- `point remove` requires explicit confirmation in interactive environments
- `point rename` changes both file path and derived ID

### Study

```bash
learn study start <goal> <pointId>
learn study done <goal> <pointId> --mastery <0-5>
learn study mastery <goal> <pointId> <0-5>
learn study pause <goal> <pointId>
learn study resume <goal> <pointId>
```

State transitions:

- `study start`: `todo -> learning`, update `lastStudiedAt`, update `updatedAt`
- `study done`: set `mastery`, update `lastStudiedAt`, set `status` to `learned` or `reviewing`
- `study mastery`: only changes `mastery` and `updatedAt`
- `study pause`: set `status = paused`
- `study resume`: restore `paused -> learning` unless `mastery >= 5`, then keep `mastered`

### Review

```bash
learn review check <goal>
learn review done <goal> <pointId> --grade again|hard|good|easy
learn review log <goal>
learn review log <goal> <pointId>
```

Semantics:

- `review check` scans `points/**/*.md`, never trusts `.learn/index.json` blindly
- `review done` updates point frontmatter and appends one JSON object to `review-log.jsonl`
- `review log` prints all review events in reverse chronological order
- `review log <pointId>` filters by `pointId`

Scheduling rules:

```txt
again -> now + 10 minutes, mastery - 1, lapseCount + 1
hard  -> now + 1 day, mastery unchanged
good  -> now + max(1, intervalDays * 2) days, mastery + 1
easy  -> now + max(1, intervalDays * 3) days, mastery + 1
```

Additional rules:

- `reviewCount` increments on every `review done`
- `lastReviewedAt` is always set
- `nextReviewAt` is always set after `review done`
- `status` becomes `reviewing` after the first review unless mastery reaches `5`
- `status` becomes `mastered` when `mastery >= 5`

### Relate

```bash
learn relate list <goal> <pointId>
learn relate add <goal> <pointId> <relativePath>
learn relate remove <goal> <pointId> <relativePath>
learn relate check <goal>
```

Semantics:

- all values stored in `relate` are relative Markdown paths
- `relate add` rejects duplicates
- `relate remove` is exact-match only
- `relate check` validates path existence and self-reference rules

### Index

```bash
learn index rebuild <goal>
learn index status <goal>
```

Semantics:

- `index rebuild` fully regenerates `.learn/index.json` from point files
- `index status` compares the generated snapshot against current point file mtimes

### Stats

```bash
learn stats <goal>
learn stats <goal> --by domain
learn stats weak <goal>
```

Semantics:

- `stats` returns total count, status distribution, mastery distribution, due count
- `stats --by domain` groups points by domain
- `stats weak` returns low-mastery or high-lapse points

Weak-point default filter:

```txt
mastery <= 2
or lapseCount >= 2
or confidence <= 40
```

### Validate And Doctor

```bash
learn validate <goal>
learn doctor <goal>
```

Semantics:

- `validate` is read-only and exits non-zero on any violation
- `doctor` only applies safe auto-fixes
- `doctor` must print every applied fix
- `doctor` must print every blocked fix with an explicit reason

## Command Output Style

Human-facing commands should default to readable text.

Recommended flags:

```bash
--json
--quiet
--no-index
```

Rules:

- `--json` returns machine-readable payloads
- `--quiet` suppresses non-error output
- `--no-index` skips post-write index rebuild for batch operations

## Write Rules

All write commands must:

1. read the target Markdown file
2. parse YAML frontmatter
3. validate preconditions
4. apply the minimal state update
5. set `updatedAt`
6. write the Markdown file back
7. rebuild `.learn/index.json` unless `--no-index`
8. validate the changed files before exit

## Error Model

Suggested exit codes:

- `0`: success
- `1`: validation failure
- `2`: usage error
- `3`: not found
- `4`: unsafe mutation refused
- `5`: schema or parsing failure

## MVP Scope

First implementation priority:

```bash
learn goal init <goal>

learn point add <goal> <path>
learn point list <goal>
learn point show <goal> <pointId>

learn study start <goal> <pointId>
learn study done <goal> <pointId> --mastery <0-5>

learn review check <goal>
learn review done <goal> <pointId> --grade again|hard|good|easy

learn index rebuild <goal>
learn validate <goal>
learn stats <goal>
```

That is the minimum closed loop for:

- goal creation
- point creation
- study progression
- review scheduling
- review history
- snapshot generation
- quality validation
