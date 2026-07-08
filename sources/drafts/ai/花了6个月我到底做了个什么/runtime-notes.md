---
---
# Runtime 核心架构总结

> 这份总结描述 ModelCraft runtime 的真实数据流：
> **以数据库表为事实源，在其上增强 meta 信息，再生成动态 GraphQL 和 JSON Schema，最后由运行时请求上下文和权限拦截驱动 SQL 执行。**

## 一句话概括

runtime 不是“凭空生成 GraphQL”，而是：

1. 先从数据库里的模型定义表读取事实数据
2. 再把 enum、relation、widget、nullable、displayOrder 等信息补成可执行 meta
3. 然后分别生成两条消费链：
   - **JSON Schema**：给前端表单和 UI 渲染使用
   - **Dynamic GraphQL**：给 runtime 查询和变更使用
4. 请求执行时，再注入权限、client DB 连接、dataloader，最终翻译成 SQL

---

## 1. 事实源是什么

runtime 的前提不是 `RuntimeModel`，而是数据库里的这些定义表：

- `model_database`：项目接管的数据库注册表
- `models`：模型主表
- `field_definitions`：字段定义表
- `logical_foreign_keys`：逻辑外键表，记录真实关系语义
- `model_enums`：枚举定义表
- `model_field_enum_associations`：字段和枚举的关联表
- `database_name.model_name`：实际业务数据表

这些表提供了 runtime 所需的事实基础：

- 一个模型属于哪个数据库
- 字段是什么类型
- 是否是主键、唯一、必填
- 是否关联枚举
- 是否关联逻辑外键
- 关系是 many-to-one 还是 one-to-many

---

## 2. meta 是怎么增强出来的

runtime 依赖的不是裸字段，而是增强后的 meta。

### 增强步骤

1. 加载 `models` 和 `field_definitions`
2. 根据 `enum_name` 补全枚举定义
3. 根据 `belongs_to_fk_id` / `relate_fk_id` 补全关系信息
4. 从 `logical_foreign_keys` 读取方向和基数
5. 把这些信息写进字段 metadata
6. 生成 JSON Schema 和 RuntimeModel 快照

### 增强后的 meta 典型内容

- `isPrimary`
- `isUnique`
- `displayOrder`
- `nullable`
- `widget`
- `relation`
- `enum`
- `validateRule`
- `precision`
- `scale`
- `minDate` / `maxDate`
- `minTime` / `maxTime`

这意味着：

- **数据库表定义的是事实**
- **meta 定义的是如何消费这些事实**

---

## 3. JSON Schema 的角色

JSON Schema 是前端表单渲染的唯一数据源。

### 设计原则

- 顶层只放标准 JSON Schema 字段
- ModelCraft 专有扩展统一放到 `x-mc`
- `x-mc.widget` 直接表达渲染意图，前端不做推断

### 典型结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "User",
  "required": ["name"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["active", "disabled"],
      "x-mc": {
        "widget": "enum-select",
        "isPrimary": false,
        "isUnique": false,
        "displayOrder": "a2",
        "nullable": true,
        "enum": {
          "name": "StatusEnum",
          "displayName": "状态",
          "isMultiSelect": false
        }
      }
    }
  }
}
```

### 作用

- 给前端表单提供字段类型、校验规则、控件类型
- 给前端提供 relation / enum 的显示信息
- 作为模型导入和同步时的重要契约

---

## 4. RuntimeModel 的角色

`RuntimeModel` 是运行时快照，不是设计态实体本身。

它的作用是把数据库里的模型定义压缩成 GraphQL 构建所需的最小集合：

- `ID`
- `OrgName`
- `ProjectSlug`
- `Name`
- `Title`
- `Description`
- `DatabaseName`
- `DisplayField`
- `Fields`

runtime 不直接依赖 `modeldesign` 的完整实体，而是依赖这个快照。
这样可以把：

- 设计态变更
- 运行态查询

分离开来。

---

## 5. Dynamic GraphQL 的角色

GraphQL 是 runtime 的执行入口。

### 生成方式

`GraphqlSchemaManager` 基于 `RuntimeModel` 构建 Schema：

- 为每个模型生成 Query / Mutation
- 为字段生成输入类型
- 为关系字段生成 resolver
- Schema 可缓存，因为 resolver 不持有请求级状态

### 关键约束

`graphqlModelResolver` 必须是无状态的：

- 不保存 `context.Context`
- 不保存 `clientRepo`
- 不保存 dataloader

请求级状态必须通过 `graphqlRequestContext` 注入。

---

## 6. 请求执行链路

runtime 请求执行时，真实链路大致如下：

```mermaid
sequenceDiagram
  autonumber
  actor Client
  participant Handler as Runtime Handler
  participant App as GraphqlAppService
  participant SchemaMgr as GraphqlSchemaManager
  participant Resolver as graphqlModelResolver
  participant ReqCtx as graphqlRequestContext
  participant Perm as Permission Check
  participant Repo as ClientDBRepoImpl
  participant SQL as SQL Mapper
  participant DB as Business Table

  Client->>Handler: POST runtime GraphQL request
  Handler->>App: Execute(query, variables, operationName)

  App->>SchemaMgr: GetSchema(modelLocator)
  alt cache miss
    SchemaMgr->>SchemaMgr: Load RuntimeModel snapshot
    SchemaMgr->>Resolver: newGraphqlSchema(RuntimeModel)
    Resolver-->>SchemaMgr: graphql.Schema
  end
  SchemaMgr-->>App: schema

  App->>ReqCtx: WithGraphqlRequestContext(clientRepo, perms, loaders)
  App->>Resolver: graphql.Do(schema, reqCtx)

  Resolver->>Perm: CheckAction(ActionSelect / Insert / Update / Delete)
  alt denied
    Perm-->>Resolver: deny
    Resolver-->>App: error
    App-->>Handler: error response
  else allowed
    Perm-->>Resolver: allow
    Resolver->>Resolver: build input + inject row filter
    Resolver->>Repo: FindMany / FindUnique / CreateOne ...
    Repo->>SQL: convert input -> SQL
    SQL->>DB: SELECT / INSERT / UPDATE / DELETE
    DB-->>SQL: rows / result
    SQL-->>Repo: result
    Repo-->>Resolver: result
    Resolver-->>App: graphql.Result
    App-->>Handler: response
  end
```

---

## 7. 权限 intercept 放在哪

权限不是后置审计，而是 runtime 执行路径的一部分。

### 两层拦截

1. **动作级拦截**
   - `CheckAction(ActionSelect / ActionInsert / ActionUpdate / ActionDelete)`
   - 没权限直接拒绝

2. **行级拦截**
   - 如果是 self scope 或 row scope，会自动注入 row filter
   - 例如只允许当前用户看到自己的数据

### 作用点

权限过滤会在构建输入后、SQL 执行前进入查询条件：

- GraphQL where 条件
- 当前用户 ID
- model owner / end-user ref 字段
- deleted_at / soft-delete 相关约束

---

## 8. GraphQL 到 SQL 的示例

### GraphQL 示例

```graphql
query {
  findManyUser(where: { status: { equals: "active" } }) {
    items {
      id
      name
    }
  }
}
```

### 经过权限 intercept 后的语义

- 先检查是否允许 `select`
- 如果是 self scope，则注入当前用户的 row filter
- 合并用户传入的 where 条件

### 对应 SQL 语义

```sql
SELECT id, name
FROM users
WHERE status = 'active'
  AND owner_user_id = :currentUserID
  AND deleted_at = 0
ORDER BY created_at DESC
LIMIT 20;
```

这不是机械字符串拼接，而是：

1. GraphQL 参数构建 runtime input
2. 权限规则注入额外过滤条件
3. SQL mapper 把 input 翻译成 SQL
4. repository 执行数据库查询

---

## 9. Dataloader 的角色

关系字段解析时，runtime 用 dataloader 解决 N+1 问题。

### 典型场景

- many-to-one
- one-to-many
- 关联字段批量加载

### 为什么需要它

GraphQL resolver 是分字段执行的，如果每个关联字段都查一次数据库，会产生 N+1 问题。

runtime 的做法是：

- resolver 先返回 thunk
- graphql-go 先收集多个 thunk
- dataloader 批量合并请求
- 最终一次查出多条关联数据

---

![ModelCraft Runtime 核心架构图](普通用户数据查询链路图.png)

## 10. 简化架构图

```mermaid
flowchart LR
  subgraph Source[数据库事实层]
    D0[(model_database)]
    D1[(models)]
    D2[(field_definitions)]
    D3[(logical_foreign_keys)]
    D4[(model_enums)]
    D5[(model_field_enum_associations)]
    D6[(业务数据表<br/>database_name.model_name)]
  end

  subgraph Meta[Meta 增强层]
    M0[读取表定义]
    M1[补全 enum / relation]
    M2[补全 displayOrder / nullable / widget]
    M3[生成 JSON Schema<br/>Draft 7 + x-mc]
    M4[构建 RuntimeModel 快照]
  end

  subgraph Runtime[Runtime GraphQL 层]
    R0[GraphqlSchemaManager]
    R1[graphqlModelResolver<br/>无状态 schema 构建器]
    R2[graphqlRequestContext<br/>clientRepo / perms / loaders]
    R3[graphql.Do]
    R4[权限 intercept<br/>CheckAction + RowFilter]
    R5[Dataloader]
    R6[ClientDBRepoImpl]
    R7[SQL Mapper]
  end

  subgraph Consumer[消费端]
    C0[前端表单 / RJSF]
    C1[动态 GraphQL API]
  end

  D0 --> D1
  D1 --> D2
  D1 --> D3
  D1 --> D4
  D1 --> D5
  D1 --> D6

  D2 -->|belongs_to_fk_id / relate_fk_id| D3
  D2 -->|enum_name| D4
  D3 -->|model_id / ref_model_id| D1
  D5 -->|field_name <-> enum_name| D4

  D1 --> M0
  D2 --> M0
  D3 --> M0
  D4 --> M0
  D5 --> M0
  M0 --> M1 --> M2 --> M3 --> M4

  M3 --> C0
  M4 --> R0 --> R1
  R0 --> R2
  R1 --> R3
  R2 --> R3
  R3 --> R4 --> R5 --> R6 --> R7 --> D6
  R1 --> C1

  R4 -. deny .-> C1
```

---

## 11. 这套架构最重要的边界

### 设计态负责

- 定义模型
- 定义字段
- 定义 enum
- 定义 logical foreign key
- 导出 JSON Schema

### 运行态负责

- 从快照生成 schema
- 接收请求
- 注入权限
- 处理 dataloader
- 执行 SQL

### 前端负责

- 消费 JSON Schema
- 渲染表单
- 调用动态 GraphQL API

---

## 12. 结论

runtime 的核心不是“GraphQL 本身”，而是这条链路：

**数据库表事实源 -> meta 增强 -> JSON Schema / RuntimeModel -> 动态 GraphQL -> 权限 intercept -> SQL -> 业务表**

如果只记一句话，就记这个：

> **ModelCraft runtime 是一个以数据库表为底座、以 meta 为协议、以动态 GraphQL 为执行层的运行时引擎。**
