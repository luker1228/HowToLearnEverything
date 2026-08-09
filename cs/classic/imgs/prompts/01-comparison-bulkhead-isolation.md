---
illustration_id: 01
type: scene
style: sketch-notes
purpose: 文章封面 - 旁路慢任务拖垮核心业务（故障态）
---

# 封面 - 共享线程池被旁路慢任务占满，核心业务被拖死

A hand-drawn sketch-notes cover illustration on warm cream paper (#F5F0E8). Slight wobble on every black ink line, Mike Rohde sketchnoting style. Diagram-style doodle visuals ONLY — no realistic or photographic images, no gradients, no shadows.

CORE MESSAGE (must read at a glance): one SHARED thread pool is hijacked by side-path slow tasks, so core business is starved and dragged down. This is the FAILURE state — NOT isolation, NOT a protective wall, NOT two separate safe/unsafe pools. NO bulkhead wall anywhere.

PALETTE:
- Background: Warm Cream (#F5F0E8)
- Ink: Near Black (#1A1A1A) for ALL lines, outlines, text, doodles
- Core business accents: Mint Green (#B5E5CF) + soft Macaron Blue (#A8D8EA) — but currently suffering
- Slow-task chaos: Coral Red (#E8655A) + Peach (#FFD5C2) — dominant, overwhelming
Color fills leave slight hand-painted overshoot. Never paint hex codes or color names as visible text.

COMPOSITION (single shared pool as HERO, 16:9):

1) CENTER — ONE large shared round pool, labeled hand-lettered "共享业务线程池".
   - The pool is the only tank. There is NO dividing wall, NO second pool.
   - Pool is stuffed full of coral-red slow tasks: giant grinding gears, stacked heavy task blocks marked "3–5min", fire 🔥, smoke, alarm bell.
   - All worker stick-figures / worker slots inside the pool are occupied by the slow red work — nobody free for core traffic.
   - Red water / task sludge overflows the rim and spills outward.

2) THE "拖垮" ACTION (critical — must feel causal):
   - From the overflowing red mass, a thick hand-drawn rope / chain / thick arrow yanks downward and sideways onto the core-business side.
   - OR: red overflow flood literally pours onto and drowns the core-business queue (same shared resource, contagion).
   - Core path is not merely "busy" — it is being dragged under by the side tasks.

3) CORE BUSINESS (suffering, secondary but clear):
   - Small blue/mint request arrows labeled "核心请求" stuck OUTSIDE the pool, blocked, cannot enter.
   - One or two tiny stick figures for core business: panicked, arms up, falling / being pulled down, with a big black ✕ or skull doodle above.
   - Mood: starved, dead, crushed — opposite of calm/safe.

4) SIDE-PATH SOURCE (left or top-left, supporting):
   - A small Kafka / message icon with many red arrows flooding into the shared pool, labeled "旁路慢任务".
   - Emphasize volume: many identical slow jobs pouring in (amplification / spam).

MOOD: crisis, cascading failure, one frontend bug → backend core path dead. Educational but dramatic. Viewer should feel "the side job killed the main business."

TEXT: MINIMAL hand-lettered keywords only (max 4 short labels):
- "共享业务线程池" on the pool
- "旁路慢任务" near the red flood
- "核心请求" near the blocked blue requests
- optional tiny "拖垮!" callout near the yank/drown action
No long sentences. No "Bulkhead". No "✓" on the core side.

STYLE: airy cream paper, hand-drawn wobble, no computer fonts, no gradients, no shadows. Main mass centered; generous margins.

ASPECT: 16:9, medium complexity (one clear story, not cluttered).
