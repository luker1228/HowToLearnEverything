---
type: infographic
density: per-section
style: sketch-notes
palette: macaron
image_count: 9
---

## Illustration 1

**Position**: ## 云 API 的平替 / 简单介绍云 API 三条之后
**Purpose**: 一眼看出 GraphQL 是云 API 的轻量平替，不是另一套 REST
**Visual Content**: 左「云 API」三块：ActionName、全部 POST、错误码标准；右「GraphQL」三块：SDL 契约、一个入口、调用方勾字段
**Type Application**: infographic — 左右对照 + 底部一句
**Filename**: 01-infographic-cloudapi-vs-graphql.png

## Illustration 2

**Position**: ### 先认三样东西
**Purpose**: 把入口、操作名、勾选字段钉成三块
**Visual Content**: 三张卡片：入口只有一个 POST /graphql；操作有名字 user ≈ Action；返回值由调用方勾选
**Type Application**: infographic — 三栏
**Filename**: 02-infographic-three-things.png

## Illustration 3

**Position**: ## Overfetch / 两份 order 查询之后
**Purpose**: 说明没勾的关联可以不跑
**Visual Content**: 左「只要订单」id + amount；右「连客户商品」customer / items；中间一棵可勾选的树
**Type Application**: infographic — 左右两态
**Filename**: 03-infographic-overfetch.png

## Illustration 4

**Position**: ## Schema：interface / Node 示例之后
**Purpose**: interface 抽的是契约，不是抄字段
**Visual Content**: 中心 Node { id }；四周 User / Order implements；下方 node(id): Node
**Type Application**: infographic — 中心辐射
**Filename**: 04-infographic-interface-node.png

## Illustration 5

**Position**: ## 操作鉴权：hasPermission + Casbin / Enforce 之后
**Purpose**: 声明和判定怎么对上，act 枚举一眼能读
**Visual Content**: 上 @hasPermission(action: "order:create") → Enforce(user, order, create)；中 act 六枚举；下 order:* = 全部动作
**Type Application**: infographic — 上下流程 + 枚举条
**Filename**: 05-infographic-haspermission-casbin.png

## Illustration 6

**Position**: ## 可空性：! 也是契约 / TS 对照之后
**Purpose**: ! 直接进 TypeScript
**Visual Content**: 左 SDL：id ID! / name String! / email String；右 TS：string / string / string | null
**Type Application**: infographic — 左右映射
**Filename**: 06-infographic-nullability.png

## Illustration 7

**Position**: ## 演进：加字段，废弃才标 / @deprecated 之后
**Purpose**: 废弃是明确标记，方便 AI 选用
**Visual Content**: phone 划线 @deprecated reason: use mobile；旁边 mobile 高亮；角标 isDeprecated
**Type Application**: infographic — 旧→新
**Filename**: 07-infographic-deprecated.png

## Illustration 8

**Position**: ## Introspection：协议能解释自己 / JSON 探测之后
**Purpose**: Introspection 是 AI 飞轮的根
**Visual Content**: 三步：问 __type → 读 NON_NULL / isDeprecated → 生成合法查询
**Type Application**: infographic — 三步飞轮
**Filename**: 08-infographic-introspection.png

## Illustration 9

**Position**: ## 前端：查询即类型 / codegen 类型之后
**Purpose**: 勾了什么，TS 就有什么
**Visual Content**: 左 query 勾 id amount customer.name；右 GetOrderQuery 同形；底 error.__typename 分支
**Type Application**: infographic — 查询→类型
**Filename**: 09-infographic-query-is-type.png
