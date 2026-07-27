image_count: 1
density: minimal
---

## Illustration 1

**Position**: Section 10（简化架构图）之前 / 文章核心位置
**Purpose**: 一图展示 ModelCraft runtime 完整数据流：数据库事实源 → Meta 增强 → JSON Schema / RuntimeModel → 动态 GraphQL → 权限拦截 → SQL → 业务表
**Visual Content**: 三层横向分区架构图：底层「数据库事实层」（6张定义表）→ 中层「Meta 增强层」（增强步骤链）→ 顶层「Runtime GraphQL 层」（Schema 构建、权限拦截、Dataloader、SQL 执行），右侧「消费端」（前端表单 / 动态 GraphQL API）
**Filename**: 01-framework-runtime-architecture.png
