# mdtree

`mdtree` is a small TypeScript CLI for validating Markdown metadata and generating a readable Markdown index.

It is built for Markdown knowledge bases where every file must keep a small YAML frontmatter block in sync with the file itself.

## Commands

```bash
mdtree init
mdtree new <file>
mdtree check <path>
mdtree index <path> [--out <path>]
```

## What It Checks

Every Markdown file must start with YAML frontmatter:

```md
---
name: gpt-taste
description: Short summary of what this file is about.
timestamp: 2026-07-08T10:30:00.000Z
kind: simple
related: []
---
```

`mdtree check` validates:

- Frontmatter exists at the top of the file
- `name` exists
- `description` exists
- `description` is not empty after trimming whitespace
- `timestamp` exists
- `timestamp` is an exact ISO string
- `timestamp` matches the file `mtime` within `1000ms`
- `kind` is `simple` or `complex`
- `related` is a YAML string array
- `related` references existing nodes bidirectionally
- `name` is unique within the scanned path

Extra frontmatter fields are allowed.

## Init

Run this first:

```bash
mdtree init
```

It creates `mdtree.config.json` in the current directory:

```json
{
  "ignore": ["**/node_modules/**", "**/.git/**", "**/index.md"],
  "indexOutput": "./index.md"
}
```

If this file does not exist, `check` and `index` fail and tell you to run `mdtree init`.

## Check

```bash
mdtree check wiki
```

The command scans `.md` files under the given path and prints lint-style errors:

```text
/abs/path/wiki/style-guide.md: missing_frontmatter: missing YAML frontmatter at the top of the file
/abs/path/wiki/intro.md: empty_description: "description" must not be empty
/abs/path/wiki/topic.md: timestamp_mismatch: "timestamp" does not match file mtime within 1000ms. expected=... actual=...
```

Exit codes:

- `0` if all scanned files are valid
- `1` if any validation error is found

## New

```bash
mdtree new wiki/nodes/example.md
mdtree new wiki/nodes/example.md --name english-gerund-rule --title "English Gerund Rule"
mdtree new wiki/nodes/example.md --description "Distinguishes gerund usage after specific verbs."
mdtree new wiki/nodes/example.md --kind complex --related node-a,node-b
```

The command creates a Markdown file with valid frontmatter and a first heading.

Default behavior:

- `name` defaults to the filename without `.md`
- `description` defaults to `TODO: update description.`
- `kind` defaults to `simple`
- `related` defaults to `[]`
- `timestamp` is generated automatically and aligned to the file mtime

## Index

```bash
mdtree index wiki
mdtree index wiki --out ./artifacts/wiki-index.md
```

The command writes a readable Markdown tree and only includes valid files.

Example output:

```md
# Markdown Index

Root: /abs/path/wiki

- /abs/path/wiki
  - writing/
    - [style-guide](/abs/path/wiki/writing/style-guide.md)
      - description: Personal writing rules and patterns.
      - timestamp: 2026-07-08T10:30:00.000Z
```

If invalid files exist, `mdtree` still writes a partial index, skips invalid files, prints errors, and exits with code `1`.

## Config

`mdtree` looks for `mdtree.config.json` from the current working directory upward.

Supported fields:

- `ignore`: glob-style patterns used during scanning
- `indexOutput`: default path for generated index output

Path behavior:

- `indexOutput` is resolved relative to the directory that contains `mdtree.config.json`
- `--out` overrides `indexOutput`
- `--out` relative paths are resolved from the current working directory

## Development

This project currently uses Node.js 22 runtime type stripping instead of a build step.

Examples:

```bash
./bin/mdtree init
./bin/mdtree check wiki
./bin/mdtree index wiki
```
