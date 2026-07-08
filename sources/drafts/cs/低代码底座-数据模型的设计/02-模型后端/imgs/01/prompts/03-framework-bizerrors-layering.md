---
illustration_id: 03
type: framework
style: notion
---

Go business error layering - framework diagram

Layout: bottom-up layered diagram with error translation flow

ZONES:
- Bottom zone: storage errors area with three small cards: `sql.ErrNoRows`, `duplicate key`, `timeout`
- Middle-left zone: `repository` translation card labeled `mapDBError`
- Middle-center zone: `bizerrors.BusinessError` main card showing `code + message + wrappedError + stack`
- Top zone: two output cards side by side: `HTTP 409 / 404 / 500` and `GraphQL extensions.code`
- Side note: `不要把底层驱动错误直接暴露给上层`

LABELS:
- `sql.ErrNoRows`
- `duplicate key`
- `timeout`
- `repository`
- `mapDBError`
- `bizerrors`
- `BusinessError`
- `code`
- `wrappedError`
- `HTTP`
- `GraphQL`
- `稳定错误语义`

COLORS:
- Background: soft off-white #F8F6F2
- Low-level error cards: light red-beige #EBCBC5
- Repository card: sand #E9DDC8
- bizerrors core card: muted green #CFE0CF
- Output cards: light blue #C9DAEC
- Text and outlines: dark charcoal #1F1F1F

Color values (#hex) and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text in the image.

STYLE:
- notion minimal diagram style
- clean upward arrows showing translation, not raw propagation
- emphasize `稳定错误语义` as the center idea
- simple, readable, educational, no heavy textures

Clean composition with generous white space. Simple or no background. Main elements centered or positioned by content needs.
Text should be large and prominent with handwritten-style fonts. Keep minimal, focus on keywords.
ASPECT: 16:9, medium complexity
