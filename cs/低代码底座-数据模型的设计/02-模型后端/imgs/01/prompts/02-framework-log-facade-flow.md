---
illustration_id: 02
type: framework
style: notion
---

Go log facade architecture - framework diagram

Layout: left-to-right flow diagram with four stages

ZONES:
- Stage 1: business code card showing `logger.Infof(ctx, ...)` and `logger.Errorf(ctx, err, ...)`
- Stage 2: `logfacade.Logger` card as the unified facade, with a subtitle `唯一日志格式`
- Stage 3: extraction card split into two lanes: `ctx -> request_id / trace_id / user_id` and `err -> error / stack`
- Stage 4: sink card labeled `zap` and `structured logs`, ending with example fields shown as tags
- Bottom strip: one conclusion note `业务层不依赖具体日志库，但日志上下文和堆栈必须自动补齐`

LABELS:
- `业务代码`
- `logfacade.Logger`
- `context`
- `error`
- `request_id`
- `trace_id`
- `stack`
- `zap`
- `结构化日志`
- `统一日志格式`

COLORS:
- Background: soft off-white #F7F6F3
- Stage cards: pale gray #EFEDE8
- Context lane: soft blue #C9DDF2
- Error lane: soft coral #EAC8C0
- Facade highlight: muted green #CDE2D1
- Output tags: warm beige #E7DCC8
- Outlines and text: near-black #202020

Color values (#hex) and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text in the image.

STYLE:
- notion-style minimalist system sketch
- thin black outlines, rounded cards, simple arrows
- strong whitespace, calm SaaS-like layout
- show `f` style logging as a small detail, but do not overcrowd
- all text in Chinese except code snippets and field names

Clean composition with generous white space. Simple or no background. Main elements centered or positioned by content needs.
Text should be large and prominent with handwritten-style fonts. Keep minimal, focus on keywords.
ASPECT: 16:9, medium complexity
