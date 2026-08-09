---
type: flowchart
density: minimal
style: notion
palette: default
image_count: 1
preset: process-flow
language: zh
topic: threadpool-execute-flow
---

## Illustration 1

**Position**: 全文 / ThreadPoolExecutor.execute 决策流程
**Purpose**: 把 Java 线程池 `execute` 的完整决策树（核心线程 → 队列 → 非核心线程 → 拒绝策略）一眼讲清
**Visual Content**: 自上而下流程图：起点 submit → 三个菱形判断（corePoolSize / 队列 / maximumPoolSize）→ 四个终点结果
**Type Application**: flowchart 决策树，是/否分支清晰标注
**Filename**: 01-flowchart-threadpool-execute.png
