# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

This is a **teaching workspace** driven by the `teach` skill (`~/.claude/skills/teach/SKILL.md`, invoked via `/teach`). It is not a software project — there is nothing to build, lint, or test. The mission is defined in `MISSION.md`: helping the user understand LLM Agent architecture, using `pi/packages/agent` (`@earendil-works/pi-agent-core`) as the concrete reference implementation and `ai-agent-book/` (李博杰《深入理解 AI Agent》) as the theory grounding.

Before doing any teaching work, read in this order: `MISSION.md` → `NOTES.md` → `RESOURCES.md` → `learning-records/*.md` (numeric order) → the highest-numbered file in `lessons/` (to see where teaching left off). Don't re-derive context that's already captured in these files.

## Reference sources are NOT version-controlled — they can be missing

`pi/` (the pi-agent-core monorepo, has its own nested `.git`) and `ai-agent-book/` are **untracked** in this repo (confirmed via `git status --ignored`) — not gitignored, just never committed. They are local clones the user loads in manually, and they will be **absent in a fresh checkout or new sandbox**.

If either directory is missing or a file path cited in an existing lesson/reference card doesn't resolve:
- Do not reconstruct their content from parametric memory — `MISSION.md`'s explicit constraint is "学习应紧密结合 `pi/packages/agent` 的真实源码，不要脱离代码库空谈理论".
- Tell the user and ask them to reload/re-clone the missing source before continuing that lesson.

## Workspace conventions

- `lessons/000N-<slug>.html` and `reference/000N-<slug>.html` are paired 1:1 by number — same number, same topic. A lesson without a matching reference card is incomplete.
- `learning-records/000N-<slug>.md` is numbered independently of lessons — it captures corrections/confirmations from conversation, not lesson content.
- `assets/style.css` and `assets/quiz.js` are shared across every lesson/reference card. Read them before writing a new lesson; never inline duplicate CSS or reimplement the quiz widget.
- To preview a lesson with working relative links (`../assets/...`, `../pi/packages/agent/README.md`, etc.), serve from this directory rather than opening the file directly:
  ```
  python3 -m http.server <port> --bind 127.0.0.1
  ```
  then open `http://127.0.0.1:<port>/lessons/000N-<slug>.html`.

## Teaching approach for this user

- 中文授课。
- 用户学习风格是先自己猜一个答案（提出假设），再让老师用源码验证/纠正——遇到概念性问题时，优先引导他先猜，而不是直接给结论（见 `learning-records/0002`、`0003`）。
- 用户明确要求：教学要**从问题到答案的角度思考**——先讲清楚这段代码/机制在解决什么实际问题，再落到具体实现细节，不要一上来就扎进代码细节本身。同时，用户自己不一定能提前想到该问什么问题，所以老师要主动预判、提出他还没想到但对理解至关重要的问题。
- 聊天里做的任何实质性纠正，要立刻同步进对应的 `reference/` 卡片——聊天记录是一次性的，reference 卡片才是用户会回来查的地方（见 `NOTES.md`）。
