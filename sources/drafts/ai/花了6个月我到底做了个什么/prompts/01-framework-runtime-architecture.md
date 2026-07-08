---
illustration_id: "01"
type: framework
style: vector-illustration
palette: ~
---

ModelCraft Runtime 核心架构 - 三层数据流图

Flat vector architecture diagram. Clean white background. Bright, airy, modern style. Simple geometric boxes with soft shadow. No dark backgrounds.

STRUCTURE: Three horizontal bands stacked top-to-bottom, left-to-right flow within each band. A slim Consumer column on the right edge.

BAND 1 — 数据库事实层 [BOTTOM, very light blue fill #E8F4FD]:
7 small rounded rectangles in a horizontal row, connected by thin right-pointing arrows:
  model_database → models → field_definitions → logical_foreign_keys → model_enums → model_field_enum_associations → 业务数据表
Band label (left side, bold): 数据库事实层
Color: nodes fill #DBEAFE, border #3B82F6

BAND 2 — Meta 增强层 [MIDDLE, very light green fill #F0FDF4]:
5 nodes in a horizontal chain:
  读取表定义 → 补全 enum/relation → 补全 widget/nullable → 生成 JSON Schema → RuntimeModel 快照
Band label (left side, bold): Meta 增强层
Color: nodes fill #D1FAE5, border #10B981
Thick upward arrow from Band 1 into Band 2 on the left side.

BAND 3 — Runtime GraphQL 层 [TOP, very light purple fill #F5F3FF]:
Main horizontal flow:
  SchemaManager → ModelResolver → graphql.Do → 权限拦截 → Dataloader → SQL Mapper
A small box above graphql.Do: RequestContext (clientRepo/perms/loaders), with a downward arrow into graphql.Do
Band label (left side, bold): Runtime GraphQL 层
Color: nodes fill #EDE9FE, border #7C3AED
Thick upward arrow from Band 2 into Band 3 on the left side.

CONSUMER COLUMN [RIGHT, white background, thin border]:
Two boxes stacked:
  - 前端表单
  - GraphQL API
Arrows:
  - "生成 JSON Schema" → 前端表单 (green arrow)
  - ModelResolver → GraphQL API (purple arrow)
  - 权限拦截 → GraphQL API labeled "deny" (red dashed arrow)
  - SQL Mapper → 业务数据表 (downward arrow, blue, labeled "SQL")

COLORS: White background (#FFFFFF). Soft pastel fills per band. Black (#111111) for all text. Arrows in matching band colors. Red (#EF4444) dashed for deny path only. No dark navy, no dark grey fills anywhere.
Color values are rendering guidance only — do NOT display hex codes or color names as visible text.

STYLE: Clean, minimal, flat. Thin 1-2px borders. Soft drop shadows on band containers. Rounded corners (8px). Generous white space. Labels: short keywords only, no long descriptions. Band labels are bold and vertical or horizontal on left edge.

ASPECT: 16:9
Clean composition. White background. Simple, airy, easy to read at a glance.
