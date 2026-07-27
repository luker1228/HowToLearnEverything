# TypeScript x Learn Claude Code Study Plan

Source site: <https://learn.shareai.run/zh/>

This plan treats TypeScript as the implementation language for learning the
agent-harness ideas from the site.

## Core rule

For every topic, learn it in this order:

1. Understand the harness idea.
2. Model the data with TypeScript types.
3. Implement the mechanism in small code.
4. Explain what TypeScript guarantees and what runtime still cannot guarantee.

## Phase 1: foundations

Goal: become fluent enough in TypeScript to read and change agent code without
guessing.

- Lesson 01: primitives, objects, optional fields, arrays, functions.
- Lesson 02: discriminated unions, loop state, tool result shapes.
- Lesson 03: typed tool dispatch maps and multi-tool turns.
- Lesson 04: permission gates, deny lists, and user approval flow.
- Practice: `satisfies`, `unknown`, narrowing, `never`, readonly data.

Exit standard:

- You can explain the difference between a TypeScript type and a runtime value.
- You can model a response payload without using `any`.

## Phase 2: tools and execution

Target site sections:

- `s01 Agent Loop`
- `s02 Tool Use`
- `s03 Permission`
- `s04 Hooks`

TypeScript focus:

- union types for model blocks
- mapped records for tool dispatch
- safe parsing of tool input
- function signatures for hook pipelines

Exit standard:

- You can implement a minimal loop with typed tool execution.
- You can explain why a dispatch table is better than `if/else` sprawl.

## Lesson 02 Focus

`lesson:02` is the entry point for `s01 Agent Loop`.

- the assistant can emit text or tool-use blocks
- tool calls are handled by a typed dispatch table
- loop termination depends on a runtime `stopReason`
- the data model matters more than control flow
- the lesson now uses a real DeepSeek API key instead of a mock model

## Lesson 03 Focus

`lesson:03` is the entry point for `s02 Tool Use`.

- the loop stays stable while the tool registry grows
- each tool gets a typed input shape
- the dispatch table is the main change, not the control flow
- runtime path validation still happens outside the type system

## Lesson 04 Focus

`lesson:04` is the entry point for `s03 Permission`.

- the loop stays the same
- permission runs before tool execution
- hard denies block immediately
- rule matches can ask the user
- runtime checks still protect file paths even if approval is granted

## Phase 3: planning and memory

Target site sections:

- `s05 TodoWrite`
- `s06 Subagent`
- `s07 Skills`
- `s08 Context Compact`
- `s09 Memory`
- `s10 System Prompt`
- `s11 Error Recovery`

TypeScript focus:

- graph-like task models
- branded ids
- persistent record formats
- result types for retries and failures

Exit standard:

- You can represent task state transitions with types.
- You can separate transient context from durable state.

## Phase 4: platform features

Target site sections:

- `s12` to `s20`

TypeScript focus:

- async workflows
- concurrent job state
- message contracts between agents
- filesystem and process boundaries
- tool protocol adapters

Exit standard:

- You can design a small multi-agent harness in TypeScript.
- You can explain where types help and where system design matters more.

## Recommended study rhythm

Use one cycle per topic:

1. Read one section from the site.
2. Rebuild the idea in TypeScript locally.
3. Write down one thing TS proved for you.
4. Write down one thing TS could not prove.

Recommended pace:

- 30 to 45 minutes on TypeScript mechanics
- 30 to 45 minutes on one harness concept
- 15 minutes on recap and one small refactor

## How I will teach you

I will act as a TypeScript reviewer, not a motivational coach.

- I will ask you to make concrete edits.
- I will review exact typing decisions.
- I will point out weak abstractions early.
- I will keep linking each TS feature back to the agent architecture.

## Immediate next steps

1. Finish `lesson:01`.
2. Run `lesson:02`.
3. Run `lesson:03`.
4. Run `lesson:04`.
5. Tell me your result or paste your modified code.
6. Then we move to `s04 Hooks`.
