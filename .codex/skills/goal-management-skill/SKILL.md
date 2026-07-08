---
name: goal-management
description: >
  用来创建和维护学习目标。目标和知识树分开存放，默认工作区是 `goals`。
  当用户要设定一个阶段性计划、维护 12 周学习目标、查看目标状态、记录进度、
  或重建目标总览时，使用这个 skill。
---

# Goal Management

## 用法

优先使用 CLI 维护目标：

1. 新建目标：`mdtree goal init <slug> --title ... --focus ... --weeks 12`
2. 更新目标：`mdtree goal update <slug> --progress ... --week ... --note ...`
3. 查看目标：`mdtree goal show <slug>`
4. 列出目标：`mdtree goal list`
5. 校验目标：`mdtree goal check [slug]`
6. 重建总览：`mdtree goal index`

## 目标文件

每个目标放在 `goals/<slug>/index.md`，并配一个 `updates.md` 记录进展。

目标文档由 CLI 维护，`timestamp` 会随更新同步，避免状态漂移。

## 适用场景

- 制定 12 周雅思学习计划
- 维护阶段性学习目标
- 记录周进展和复盘
- 统一管理多个并行目标
