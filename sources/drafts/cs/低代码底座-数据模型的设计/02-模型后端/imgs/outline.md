---
type: framework
density: balanced
style: notion
palette: default
image_count: 4
---

## Illustration 1
**Position**: `## 先说结论：第一版工程架子应该长什么样` 之后
**Purpose**: 把 Go 工程目录分层一眼讲清楚
**Visual Content**: 四层结构图，展示 `cmd / app / domain / infrastructure / interfaces / pkg` 的职责关系
**Filename**: `01-framework-go-project-structure.png`

## Illustration 2
**Position**: `## 1. 如何做一个日志门面` 小节中，日志接口介绍之后
**Purpose**: 把日志门面的输入、处理、输出链路讲清楚
**Visual Content**: `context + error + logger facade + zap` 的结构化日志流转图
**Filename**: `02-framework-log-facade-flow.png`

## Illustration 3
**Position**: `## 2. 如何设计业务错误` 小节中，错误模型介绍之后
**Purpose**: 展示 `bizerrors`、repo 错误翻译、接口层映射之间的关系
**Visual Content**: 从底层存储错误到 `BusinessError` 再到 HTTP / GraphQL 的分层错误流
**Filename**: `03-framework-bizerrors-layering.png`

## Illustration 4
**Position**: `## 4. 如何搭建真正的可观测性` 小节开头之后
**Purpose**: 总结出入口日志、recovery、go func 兜底三件事
**Visual Content**: 请求链路 + recovery + `GoWithCtx` / `conc` / `pond` 三类异步封装的总览图
**Filename**: `04-framework-observability-guardrails.png`
