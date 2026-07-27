# Tool Use Summary

## README.md
# TypeScript + Node.js Learning Workspace

This directory is a hands-on workspace for learning:

- the content around <https://learn.shareai.run/zh/>
- Node.js fundamentals
- TypeScript with strict mode

## Start

```bash
npm install
npm run lesson:01
npm run lesson:02
npm run lesson:03
```

## Commands

```bash
npm run dev
npm run lesson:01
npm run lesson:02
npm run lesson:03
npm run typecheck
npm run build
```

## What We Are Studying

This repo follows the structure from <https://learn.shareai.run/zh/> and uses
TypeScript to make each idea concrete.

- `lesson:01`: TypeScript fundamentals you need before building an agent.
- `lesson:02`: `s01 Agent Loop` in TypeScript with a simulated model + tool loop.
- `lesson:03`: `s02 Tool Use` in TypeScript with a typed tool dispatch table.

Read [docs/ts-shareai-study-plan.md](docs/ts-shareai-study-plan.md) for the
full roadmap.

## Learning Path

1. TypeScript basics: primitive types, objects, arrays, unions, functions.
2. Runtime vs type system: what TypeScript checks, what Node actually executes.
3. `s01` Agent Loop: model output, tool execution, loop termination.
4. `s02`-`s04`: tool dispatch, permission gates, lifecycle hooks.
5. Async Node.js: promises, `async`/`await`, file system, HTTP.
6. Error handling and data validation.
7. Build a small CLI agent project.

## How I will teach you

I will use this repo in a practical way:

- explain one concept at a time
- give you a small exercise
- review your code and point out the exact reasoning
- gradually raise the bar from "can run" to "can design"

## First Exercise

Open [src/lessons/step1/01-types.ts](src/lessons/step1/01-types.ts) and try:

1. Add an `age: number` field to `UserProfile`.
2. Update `rawUser`.
3. Change `formatUser` so it prints the age.
4. Run `npm run lesson:01`.

## Second Exercise

Open [src/lessons/step1/02-agent-loop.ts](src/lessons/step1/02-agent-loop.ts) and try:

1. Add a new tool.
2. Make the mock model choose that tool for a new query.
3. Extend the loop result type without using `any`.
4. Run `npm run lesson:02`.

## Third Exercise

Open [src/lessons/step1/03-tool-use.ts](src/lessons/step1/03-tool-use.ts) and try:

1. Add a new tool to the dispatch table.
2. Make the fake model call that tool in the loop.
3. Keep the `while` loop unchanged.
4. Run `npm run lesson:03`.

## Lesson 02 Goal

`lesson:02` is the first real agent lesson.

- learn the shape of a minimal agent loop
- see how TypeScript models assistant blocks and tool results
- practice adding one tool at a time
- it reads `src/lessons/.env` automatically, and shell env still overrides it

## Note

This workspace uses `node --experimental-transform-types` for execution.
That avoids extra runtime tooling and makes the Node.js behavior easier to see while learning.

## Markdown files
AGENTS.md
docs/ts-shareai-study-plan.md
node_modules/@esbuild/darwin-arm64/README.md
node_modules/@types/node/README.md
node_modules/@typescript/typescript-darwin-arm64/README.md
node_modules/esbuild/LICENSE.md
node_modules/esbuild/README.md
node_modules/tsx/README.md
node_modules/typescript/README.md
node_modules/typescript/vendor/vscode-jsonrpc/README.md
node_modules/undici-types/README.md
README.md
src/lessons/step1/README.md
tool-use-summary.md

This file was created by the lesson 03 tool dispatch demo.