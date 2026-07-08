---
name: knowledge-tree
description: >
  用来创建和整理基于 Markdown 的知识节点。当前工作区默认是 `wiki`，类别是 `cs`、`ai`、`english`；
  `wiki/index.md` 管整个工作区，`wiki/<category>/index.md` 管各类别。
  用户要新建节点、补充节点内容、梳理 related 关系、抽象出更高层知识、提高可索引性、
  或在更新后重新生成索引时，使用这个 skill。任何 Markdown 文件改动后都要调用 `mdtree check`，
  重点检查 `description` 和 `timestamp` 是否同步更新，防止知识节点变坏。新建 Markdown 文件时
  优先走 `mdtree new`。
---

# Knowledge Tree

把 Markdown 文件维护成一棵持续生长的知识树。

## 先读什么

开始工作前，按这个顺序读：

1. 目标节点文件
2. 目标节点所在类别的 `index.md`
3. `wiki/index.md`
4. 同目录或邻近目录下的相关节点
5. 所有将被修改 `related` 的节点

不要在没读相关节点的情况下直接改关系。

## 节点判定

### `simple`

用于原子知识。通常只表达一个事实、一个规则、一个区分、一个模式，或者一个窄范围观察。

如果一个节点明显能拆成几条彼此独立的知识，它通常不该继续是 `simple`。

### `complex`

用于更高层抽象。只有当一个节点的价值主要来自归纳、比较、汇总多个底层节点时，才用 `complex`。

如果不确定，优先用 `simple`。

## description 规则

`description` 是检索基础设施，不是装饰文案。

必须做到：

- 直接说明节点讲什么
- 能和相邻节点区分开
- 不要空泛，不要写成 “notes” “misc” “thoughts”

如果正文的重点变了，必须同步更新 `description`。

## related 规则

只在关系真的有导航价值时才建立 `related`。

适合建立关系的情况：

- 两个节点是同一主题下的相邻知识
- 一个节点是另一个节点的对照、反例、补充
- 一个 `simple` 节点应该指向更高层抽象节点
- 一个 `complex` 节点应该回链到相关底层节点

不要因为：

- 在同一目录
- 提到同一个关键词一次
- 主题大致接近

就建立关系。

关系规则：

- `related` 里存的是节点 `name`，不是路径
- 新增 `A -> B` 时，必须同步补上 `B -> A`
- 不要添加弱关系
- 宁可少量强关系，也不要堆很多无效关系

## 什么时候新建 complex

只有在多个 `simple` 节点已经形成稳定抽象时，才新建 `complex` 节点。

新建 `complex` 的典型理由：

- 能提炼统一原则
- 能比较多个底层节点
- 能提供更高层入口
- 能显著改善检索和导航

- 不要为了“层级看起来完整”而硬造 `complex`

## 修改流程

每次整理知识树时，按这个流程执行：

1. 新建节点时，先用 `mdtree new <file>` 创建 Markdown 文件，文件放在 `wiki/<category>/...` 下。
2. 判断目标节点应该是 `simple` 还是 `complex`
3. 检查 `name` 是否稳定，避免无必要重命名
4. 更新正文、`description` 和 `related`
5. 如果改了某条关系，必须同步更新关系另一端
6. 任何 Markdown 文件修改后，立即运行 `mdtree check <path>`，确认 `description` 和 `timestamp` 没有失真。
7. 需要生成目录索引时，再运行 `mdtree index <path>`，常见目标是 `wiki` 或 `wiki/<category>`。
8. 总结这次结构变化

## 输出要求

当你完成一次知识树维护后，输出必须说明：

1. 哪些节点被修改
2. 为什么这些节点是 `simple` 或 `complex`
3. 新增或删除了哪些 `related`
4. 为什么这些关系成立
5. `mdtree check` 和 `mdtree index` 是否通过
6. `description` 和 `timestamp` 是否已同步更新

## 禁止事项

- 不要把 `simple` 节点写成大杂烩
- 不要把 `complex` 节点写成无结构总结
- 不要留下单向 `related`
- 不要把 `related` 当标签用
- 不要只改正文而不更新 `description`
