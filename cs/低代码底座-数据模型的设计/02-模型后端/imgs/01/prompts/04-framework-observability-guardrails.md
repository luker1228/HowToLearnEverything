---
illustration_id: 04
type: framework
style: notion
---

Go observability guardrails - framework overview

Layout: central request lifecycle diagram with three guardrails around it

ZONES:
- Center horizontal flow: `request.started -> action -> request.completed`, with `duration_ms` and `req_id` tags
- Left guardrail: `入口 / 出口日志` card explaining `判断请求有没有进来` and `看 action 与耗时`
- Top guardrail: `recovery middleware` card attached to the request flow, showing `panic -> request_panic log`
- Right guardrail: async execution area split into three mini cards: `GoWithCtx`, `conc`, `pond`
- Bottom takeaway: `可观测性的第一版重点，不是花哨大盘，而是日志别断`

LABELS:
- `request.started`
- `request.completed`
- `action`
- `duration_ms`
- `req_id`
- `recovery`
- `panic`
- `GoWithCtx`
- `conc`
- `pond`
- `日志不能断`

COLORS:
- Background: soft off-white #F7F5F1
- Request flow cards: light beige #ECE5D8
- Logging guardrail: light blue #CEDDF0
- Recovery guardrail: soft coral #E8C8C2
- Async guardrail: muted green #D1E1D2
- Text and outlines: near-black #212121

Color values (#hex) and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text in the image.

STYLE:
- notion style lightweight architecture illustration
- rounded shapes, thin black lines, small arrows, simple icons
- explanatory but not crowded
- emphasize three guardrails as protective rails around the main request chain

Clean composition with generous white space. Simple or no background. Main elements centered or positioned by content needs.
Text should be large and prominent with handwritten-style fonts. Keep minimal, focus on keywords.
ASPECT: 16:9, medium complexity
