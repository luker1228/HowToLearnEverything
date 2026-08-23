---
title: GraphQL
tags:
  - cs/graphql
---

# GraphQL

之前有同学私信我，想简单了解下Graphql。我其实是推荐Grpahql，如果有机会上新项目，或者当你拍板决定的时候，希望这个能列入你的考虑范围之内。

## 文档相关

[grpahql介绍](https://graphql.org/learn/introduction/)


## 云 API 的平替

不知道大家知不知道腾讯云云 API 的协议。最初用 GraphQL，其实就是想找一个云 API 协议的平替。云 API 的本质就是利用 POST + JSON Schema 去做了实现。其实非常像一个简化版本的 GraphQL。

它有哪些好处呢？

### 简单介绍云 API

1. 固定了接口名称。利用 ActionName 约定接口名称。方便鉴权。
2. 全部都是 POST 协议。
3. 返回值也是有协议的。错误码是标准的。有成体系的规范。

#### 1. 固定接口名称：ActionName

利用一个X-TC-Action 的Header就可以完成接口鉴权，接口路由。
对于业务来说非常好操作。尤其是当要切换下游流量时比如，从A服务迁移到B服务。
接口级别鉴权非常好做，直接uid + action。就能得到是否允许使用接口。

#### 2. 全部都是 POST

全部都是Post， 在牺牲了Get接口缓存的情况下，带来是安全和统一。 

客户端SDK处理起来十分方便。

#### 3. 返回值有协议，错误码是标准的
Http错误码不用标识业务本身，只负责处理路由的连通性。方便告警。默认返回200的其实都是业务错误。当500出现才是真正比如服务oom，挂掉了等现象。

![云 API 与 GraphQL 对照：ActionName、全部 POST、错误码标准，对上 SDL 契约和勾选字段](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/01-infographic-cloudapi-vs-graphql.png)

## 从一个简单的 GraphQL 开始讲

先说方向。常见 HTTP 接口是 **先写代码，再生成文档**：handler 写完了，再补 Swagger / OpenAPI，文档跟着实现走，每次接口变更，都是AI扫一遍代码，然后生成文档。

在飞速开发的项目初期，没有人会去约束这里。现在都是AI飞轮开发，边改边开发，即使你用spec编程，你也无法控制这里出入参数量的膨胀。第二个接手的人，大概率会新加参数，而不是复用。因为没人知道这里最初设计的意义。

这是现状，存在即合理。所以我认为合理。而且代价比较小。

GraphQL 反过来：**先写 SDL，再生成代码。** Schema 是契约，不是注释。类型、入参、出参先在 `.graphql` 里声明，服务端生成 resolver 接口，客户端生成查询类型。没在 Schema 里的字段，两边都写不出来。

Grpahql更像是一个古板的老教授。给你框了一个圈，你就在这个圈里蹦跶，哦，对了，现在有个时髦的说法，叫Harness。

他能带来啥好处呢，就是让你的接口跟着schema走。利用编译器强制要求你，无法直接先写实现，后变更文档。其实和云API的操作还有点类似。

以「查一个用户」这件事。云 API 大概是：

```http
POST https://cvm.tencentcloudapi.com
X-TC-Action: DescribeUser
```

```json
{ "UserId": "123" }
```

服务端按这份 Action 的出参 Schema，把整份 `Response` 吐回来。字段多不多，由协议定死。 注意云API类似一个网关，它通过在测试环境的强约束，在运行态约束了你的参数类型等。 比如你定义了int参数，返回字符串，云API会强制报错。这个东西对restful有一定改善。但是也有个问题，就是太重了。

GraphQL 也是 POST，也是一个入口，但 **操作名和返回形状写在同一份查询里**：

```graphql
query {
  user(id: "123") {
    name
    email
  }
}
```

打到同一个地址，例如 `POST /graphql`，body 通常是：

```json
{
  "query": "query { user(id: \"123\") { name email } }"
}
```

回来的格式也很固定：

```json
{
  "data": {
    "user": {
      "name": "Luke",
      "email": "luke@example.com"
    }
  }
}
```

Graphql则是在协议层进行约束。其实就是在你的Http请求出入口做了限制。

### 先认三样东西

**入口只有一个。**  
不用 `GET /users/123`，也不用为每个 Action 配一条 path。域名或 `/graphql` 固定，里面换查询文本。这点和云 API 一样：能力不长在 URL 上。

**操作有名字。**  
`user` 就是这次要调的字段，相当于 Action。后面 `(id: "123")` 是入参。鉴权、限流、审计，仍然可以按这个名字切。

**返回值由调用方勾选。**  
这是云 API 没有的一层。你写了 `name` 和 `email`，响应里就只有这两项。不要地址、不要权限位，就别写。服务端不再塞一份「该 Action 的完整出参」。

![先认三样东西：入口只有一个、操作有名字、返回值由调用方勾选](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/02-infographic-three-things.png)

失败时信封也是协议，只是换成 `errors`：

```json
{
  "errors": [
    {
      "message": "User not found",
      "path": ["user"]
    }
  ],
  "data": {
    "user": null
  }
}
```

和云 API 一样：HTTP 还是 200，业务对错看 body。连通性用状态码告警，业务失败用结构体表达。

## Overfetch

登录、用户管理这类接口，模型是死的：要什么字段，服务端写死就行。Overfetch 在这里不痛。

真正痛的是业务模型。订单要不要带客户、要不要带商品行、商品要不要带类目——每次调用不一样。REST / 云 API 出参由服务端写死，一写带关联，每次都把整棵树拉回来；不写，客户端再连打几个接口。

GraphQL 把这棵树交给调用方勾。勾了关联，才去走对应的查询；没勾，这条边可以不跑。

只要订单本身：

```graphql
query {
  order(id: "88") {
    id
    amount
  }
}
```

连客户和商品一起拿：

```graphql
query {
  order(id: "88") {
    id
    amount
    customer { name }
    items { name }
  }
}
```

性能怎么优化，看调用方要什么。一次就要多份资源，这些 SQL 本来就必须跑。只拿一部分，没勾到的关联就可以省掉。协议不替你省计算，它把「要不要拉关联」的决定权给了调用方。

![Overfetch：没勾的关联边可以不跑](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/03-infographic-overfetch.png)

## Schema：interface

前面是调用方勾字段。勾完之后，Schema 还要回答一件事：哪些 type 其实是同一种形状。

GraphQL 用 `interface` 声明这份形状。谁 `implements`，谁就必须带上这些字段。漏了，生成 resolver 过不了。

```graphql
interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  name: String!
}
```

调用方先拿公共字段，再按具体类型展开：

```graphql
query {
  node(id: "User:123") {
    id
    ... on User { name }
  }
}
```

`id` 写在 interface 上，不用每个分支再抄。业务字段用 `... on` 展开。回来是谁，看 `__typename`。

![interface Node：抽的是契约，User 和 Order 去 implements](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/04-infographic-interface-node.png)

interface 定的是契约。落地常见就两处。

### 公共字段抽一次

User、Order、Product 都有 `id`。最差的写法是每个 type 自己抄一遍。抄完 Schema 也不知道它们有关系——你没法写一个「按 id 取任意对象」的入口，客户端也无法对「凡是有 id 的东西」生成同一份类型。

`Node` 抽的不是几行字段，是一份契约：全站能被点名取回的对象，都必须有稳定的 `id`。有了它，才能写 `node(id:)` 这种跨业务入口：

```graphql
type Order implements Node {
  id: ID!
  amount: Int!
}

type Query {
  node(id: ID!): Node
}
```

```graphql
query {
  node(id: "User:123") {
    id
    ... on User { name }
    ... on Order { amount }
  }
}
```

这就是 interface 和单纯复用 type 的差别。`PageInfo` 是一份结构，嵌进各个 Connection 就行，它本身不是多态：

```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}

type OrderConnection {
  items: [Order!]!
  pageInfo: PageInfo!
}
```

入参没有 `implements`。分页不要在每个 ListInput 里再抄字段，抽一个 `PageInput` 嵌进去：

```graphql
input PageInput {
  pageIndex: Int = 1
  pageSize: Int = 20
}

input OrderListInput {
  page: PageInput
  status: OrderStatus
}

input UserListInput {
  page: PageInput
  keyword: String
}
```

校验只认 `PageInput`：默认第 1 页、默认 20 条、最大 100 条。`OrderList` 和 `UserList` 不再各写一套。

三件事别混：

- **interface**：一组 type 必须长什么样。可以当返回类型，可以 `... on` 展开。
- **type 嵌套**：同一份结构反复引用，比如 `PageInfo`。
- **input 嵌套**：入参没有继承，公共字段只能嵌。

Schema 要设计的，就是哪些形状是全站一份契约，哪些才是业务自己的。`id` 属于前者，用 interface 钉死。分页参数属于前者，用嵌套抽一次。

### interface Error

和云 API 同一条：HTTP 只表示连通性。200 是请求打到了业务；500 才是进程挂了、OOM。业务失败不要靠 400 / 404 / 422。

业务错误放在返回值的显式字段里，并且进 Schema。最佳实践是先定 `interface Error`，再让每种错去实现：

```graphql
interface Error {
  message: String!
}

type InvalidInput implements Error {
  message: String!
  suggestion: String
}

type StockNotEnough implements Error {
  message: String!
  sku: String!
}

union CreateOrderError = InvalidInput | StockNotEnough

type CreateOrderPayload {
  order: Order
  error: CreateOrderError
}

type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
}
```

调用方这样读：

```graphql
mutation {
  createOrder(input: { sku: "A1", count: 2 }) {
    order { id }
    error {
      __typename
      message
      ... on StockNotEnough { sku }
      ... on InvalidInput { suggestion }
    }
  }
}
```

`error` 为空就是成功。有值就看 `__typename`，这就是错误码：类型名稳定，给机器分支；`message` 给人看。库存不足还能带上 `sku`，这是 HTTP 状态码给不了的。

每个操作用 union 声明「这里可能出现哪几种错」。客户端按 Schema 生成分支，不会在文档里猜 404 到底是用户不存在还是订单不存在。

GraphQL 顶层的 `errors` 留给协议自己：查询写错字段、未登录、服务崩了。业务拒绝走 `payload.error`，不要混进 HTTP，也不要混进顶层 `errors` 当字符串抛。

## 操作鉴权：hasPermission + Casbin

GraphQL 入口只有一个 `POST /graphql`

操作鉴权就两件事：这个操作要什么权限，这个人有没有。`@hasPermission` 负责声明，Casbin 负责判定。两个接口刚好对上。

```graphql
directive @hasPermission(action: String!) on FIELD_DEFINITION

type Query {
  order(id: ID!): Order @hasPermission(action: "order:read")
}

type Mutation {
  createOrder(input: CreateOrderInput!): CreateOrderPayload!
    @hasPermission(action: "order:create")
}
```

`action` 写成 `obj:act`，就是 Casbin 的请求三元组。`obj` 是资源方，订单就是 `order`，用户就是 `user`。`act` 是动作，枚举就这几个：`create`、`update`、`delete`、`read`、`import`、`export`。`order:*` 表示这个资源上的全部动作。

字段一执行，directive 先拦一层：

```text
@hasPermission(action: "order:create")
        ↓
Enforce(user, "order", "create")
```

现在一个接口和权限策略的关系知道了。接下来就是看一个角色有哪些权限策略。

策略写在 Casbin 里：

```csv
p, admin, order, *
p, clerk, order, read
p, clerk, order, create
g, alice, clerk
```

admin 拿的是 `order:*`，订单上 create / update / delete / read / import / export 都能做。clerk 只有 `read` 和 `create`。打开 Schema，知道每个操作要哪条权限。打开 Casbin 策略，知道哪个角色有哪些权限。两边一对，谁能干什么是明确的。alice 是 clerk，能 `createOrder`，不能删单——不用翻 middleware，不用猜这个 handler 调了哪个 check。

![操作鉴权：@hasPermission 声明，Casbin Enforce 判定，act 枚举与 order:*](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/05-infographic-haspermission-casbin.png)


字段级也能挂。同一份 User，有 `user:read` 才能看手机号，用来处理高敏感字段权限，没有这条边直接不走：

```graphql
type User {
  id: ID!
  name: String!
  phone: String @hasPermission(action: "user:read")
}
```

权限矩阵不再是文档。Schema 是操作侧，Casbin 是角色侧。新增一个操作，漏了 directive，就是漏了声明——比漏在某个 `if` 里好找。

这对 AI 工作流很省事。一个接口捞出当前身份的权限，一个接口把 SDL 拉下来，两边一对：Schema 里挂了哪些 `obj:act`，自己有哪些能调、哪些不能调，当场就清楚。不用让AI去一个接口一个接口探测， 遇到权限问题，通过返回的权限不足的错误来探索。

## 可空性：! 也是契约

全文一直在写 `ID!`，这里点明：`!` 是契约。

```graphql
type User {
  id: ID!
  name: String!
  email: String
}
```

`id`、`name` 必须有值。`email` 没标 `!`，就可以是 `null`。codegen 到 TypeScript，一一对应：

```ts
{
  id: string
  name: string
  email: string | null
}
```

云 API / JSON Schema 里，必填常常是另写一份 `required`。GraphQL 写在类型后面，TS 不用再猜。该判空的地方编译器逼你判，不该是 `null` 的地方你也 `as` 不掉。

![可空性：ID! / String! 对应 string，String 对应 string | null](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/06-infographic-nullability.png)

入参同样。`user(id: ID!)` 没传 id，请求进不了 resolver。校验在协议层，不在 handler 里手写。

## 演进：加字段，废弃才标

GraphQL 默认加法演进：新字段直接加，旧查询不受影响。要淘汰一个字段，不删，先标废弃：

```graphql
type User {
  id: ID!
  name: String!
  phone: String @deprecated(reason: "use mobile")
  mobile: String
}
```

废弃是明确标记，不是靠文档说「别用了」。`reason` 写替代字段。AI通过introspect可以自己识别；AI 选字段时读到 `deprecated`，直接走 `mobile`，不会捡已经废除的 `phone`。

旧查询暂时还能跑，字段还在。真从 Schema 拿掉那天，codegen 一跑，所有还在勾 `phone` 的地方立刻红。先标、再删，中间给调用方搬家的时间。

![演进：phone 标 @deprecated，AI 读 deprecated 后选用 mobile](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/07-infographic-deprecated.png)

> 这点只是丝滑的一点。 本质实际上还是无法解决调用方继续调用的问题。 本质还是解决文档和编程一致的问题。

## Introspection：协议能解释自己

云 API / OpenAPI 的说明书是旁边一份文档。写完接口再补，补完就容易过时。

GraphQL 的说明书是一次查询。`__schema`、`__type` 是协议内置字段，不是另外部署的文档站。问有哪些类型、每个字段什么形状、可不可空、废不废弃，都是查，不是翻。

```graphql
query {
  __type(name: "User") {
    fields(includeDeprecated: true) {
      name
      isDeprecated
      deprecationReason
      type {
        kind
        name
        ofType { kind name }
      }
    }
  }
}
```

回来是结构化 JSON。自己探测一次，大概长这样：

```json
{
  "name": "id",
  "isDeprecated": false,
  "type": { "kind": "NON_NULL", "ofType": { "kind": "SCALAR", "name": "ID" } }
}
```

```json
{
  "name": "phone",
  "isDeprecated": true,
  "deprecationReason": "use mobile",
  "type": { "kind": "SCALAR", "name": "String" }
}
```

`kind: NON_NULL` 就是 `!`。`isDeprecated: true` 就是 `@deprecated`。权限那节说的「拉一份 SDL」，根在这里：不是下载一份可能过期的 markdown，是当场问协议自己。

这是 AI 飞轮转得起来的本质。探测 Schema → 知道有什么操作、哪些字段必填、哪些已经废弃 → 生成合法查询 → 跑起来。不用另喂文档，也不用等模型把你们的内部 DSL 训练进去。文档就是协议，协议能被查。

![Introspection：问 __type、读 NON_NULL / isDeprecated、再写合法查询](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/08-infographic-introspection.png)

## 前端：查询即类型

前面讲的全是 Schema 怎么约束服务端。约束的另一头，是前端。

REST / 云 API 这边，常见两条路。一条是人手写 `interface User`，字段对不对靠对文档。另一条是 Swagger 生成一整份出参——服务端吐什么，类型就是什么。你页面上只用 `name`，类型上却像拿了地址、权限位、创建时间。改了一个字段名，文档更新了，TS 不一定红，要等到运行时才炸。

GraphQL 反过来：你写的那份查询，就是类型的来源。勾了什么，生成什么。没勾的字段，TS 里根本没有。

还是前面那份订单查询：

```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    id
    amount
    customer { name }
  }
}
```

codegen 出来大概是：

```ts
type GetOrderQuery = {
  order: {
    id: string
    amount: number
    customer: { name: string }
  } | null
}
```

`order` 能是 `null`，是因为 Schema 里 `order(id: ID!): Order` 没加 `!`。上一节的可空性，落到 TS 就是这个 `| null`。

`order.items` 写不出来，编译不过。`customer.email` 也写不出来——查询里没勾。不是运行时 `undefined`，是编辑器里就红。

这才是「返回值由调用方勾选」落到 TypeScript 上的样子。类型和响应形状是同一份查询长出来的，不会各写各的。

前面的 `interface Error` 更明显。union 生成的是可判别联合，`__typename` 就是分支：

```ts
if (error?.__typename === 'StockNotEnough') {
  error.sku // string
  error.suggestion // 报错，这个类型上没有
}

if (error?.__typename === 'InvalidInput') {
  error.suggestion
}
```

不用在前端再维护一份错误码枚举，也不用 `as` 一把梭。Schema 里有几种错，TS 里就有几个分支。漏处理一种，`switch` 的穷尽检查能抓到。

后端把 `amount` 改成 `total`，或者把 `sku` 从 `StockNotEnough` 上拿掉。拉一次 Schema，跑一遍 codegen，前端所有用到的地方立刻红。不用等联调，不用等测试点到那个按钮。

云 API 的客户端 SDK 也是生成的，但生成的是「这个 Action 的完整出参」。GraphQL 生成的是「你这张页面勾的那一小块」。页面要的形状变了，改查询，类型跟着变。前端方便不是少写请求，是少猜、少写 `any`、少对文档。Schema 是契约，TypeScript 是执行者。

![查询即类型：勾了什么，TypeScript 就有什么](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/09-infographic-query-is-type.png)

## Graphql 也不是银弹

众所周知，银弹不存在。
Grahpql在解决问题的同时，也会带来一些列的问题。  

1. 全是Post接口，无法利用CDN以及浏览器的缓存。但是我认为，除非极端性能，我觉得这里不是问题。
2. 虽然Graphql解决了overfetch问题，但是面对新技术，前端依然可能全部自动全部fetch。需要做好推广。
3. 不算是问题的问题。新技术的接受。 1. 首先restful 不算协议， 只能说是一种风格， 所以这里只可能存在惯性问题，但是我认为在AI时代，保持这种惯性不合理。  2. 鉴权，习惯了利用URL鉴权的方式，要改为利用body鉴权。3. 网关想做一些监控的时候， 需要拆解body。 读取到Action， 有一定开销。 
4. Graphql允许一次协议进行多次query，我的实践是建议禁掉。保持简单。
```
new ApolloServer({
  schema,
  allowBatchedHttpRequests: false, // 禁止批量操作
});
```