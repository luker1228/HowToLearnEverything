---
illustration_id: 01
type: framework
style: notion
---

Go backend first-version project structure - framework diagram

Layout: hierarchical architecture map, top-down, centered

ZONES:
- Top zone: `cmd/server` as startup entry, a small launch card labeled "main.go"
- Middle zone: `internal` as the main application body, split into five rounded cards: `app/user`, `domain/user`, `infrastructure/db + logging + observe + repository`, `interfaces/graphql + http`, `pkg/bizerrors`
- Right-side annotations: short responsibility notes for each layer: `app = use case orchestration`, `domain = business rules`, `infrastructure = external implementations`, `interfaces = protocol adapters`, `pkg = shared error capability`
- Bottom zone: one takeaway strip saying `第一版先按职责分层，而不是按技术细节堆代码`

LABELS:
- `cmd/server`
- `internal/app/user`
- `internal/domain/user`
- `internal/infrastructure`
- `internal/interfaces`
- `pkg/bizerrors`
- `启动入口`
- `用例编排`
- `业务规则`
- `外部依赖实现`
- `协议适配`
- `统一错误模型`

COLORS:
- Background: soft off-white #F7F6F3
- Primary cards: light gray-beige #EFECE6
- Accent 1: muted blue #B8CCE3 for app and interfaces
- Accent 2: soft green #C9DEC8 for domain
- Accent 3: warm sand #E6D7BE for infrastructure
- Accent 4: dusty rose #E7C7C2 for pkg/bizerrors
- Text and outlines: near-black #222222

Color values (#hex) and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text in the image.

STYLE:
- notion style minimal hand-drawn line art
- rounded rectangles, thin black outlines, clean spacing
- light sketch feel but still professional
- small arrows showing dependency direction: interfaces -> app -> domain, infrastructure supporting app/domain, pkg shared by all
- no clutter, no 3D, no photorealism

Clean composition with generous white space. Simple or no background. Main elements centered or positioned by content needs.
Text should be large and prominent with handwritten-style fonts. Keep minimal, focus on keywords.
ASPECT: 16:9, medium complexity
