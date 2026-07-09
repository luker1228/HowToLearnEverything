---
name: learn-cli
description: 当用户要用本仓库的 learn CLI 初始化目标、增删查知识点、记录学习/复习、生成索引或校验学习目标时使用。
metadata:
  short-description: Learn CLI 使用规范
---

# Learn CLI Skill

当用户要创建、查看、学习、复习、校验、统计一个由本仓库 `learn` CLI 管理的学习目标时，使用这个 skill。

这套 skill 服务的是当前仓库里的 Learning Point Spec：

- 一个目标 = 一个文件夹
- 一个知识点 = 一个 Markdown 文件
- 知识点 frontmatter 是知识点状态的唯一主数据
- `.learn/index.json` 是可重建索引
- `.learn/review-log.jsonl` 是追加式事件日志
- 支持的写入口优先是 `./bin/learn`

## 何时使用

当用户要做下面这些事情时，触发这个 skill：

- 初始化一个新的学习目标
- 新增或查看一个知识点
- 开始学习某个知识点
- 完成一次学习并更新掌握度
- 检查哪些知识点需要复习
- 记录一次复习结果
- 校验某个 goal 目录是否合法
- 汇总学习进度、状态分布、复习情况
- 操作一个包含 `goal.md`、`points/`、`.learn/`、`schemas/` 的目标目录

下面这些场景不要使用这个 skill：

- 普通 wiki 维护
- 不属于 `learn` 目标体系的任意 Markdown 笔记编辑
- 在 CLI 已支持的前提下，直接手工修改 point frontmatter

## 当前命令面

如果当前请求可以被 `learn` 命令完成，优先用命令，不要先手工改文件。

```bash
./bin/learn goal init <goal-path>
./bin/learn goal show <goal-path>

./bin/learn point add <goal-path> <point-path>
./bin/learn point list <goal-path> [--domain <domain>] [--status <status>]
./bin/learn point show <goal-path> <pointId>

./bin/learn study start <goal-path> <pointId>
./bin/learn study done <goal-path> <pointId> --mastery <0-5>

./bin/learn review check <goal-path>
./bin/learn review done <goal-path> <pointId> --grade again|hard|good|easy [--note <text>]

./bin/learn index rebuild <goal-path>
./bin/learn validate <goal-path>
./bin/learn stats <goal-path>
```

## 目标拆解原则

当用户给的是“学习目标”而不是已经拆好的知识点时，不要只停留在目标层面，要继续拆成可执行的 point 列表。

判断标准：

- 每个 point 必须有明确的知识边界
- 每个 point 应该能在 1 次学习里完成一个小闭环
- 每个 point 最好能对应 1 个可检验的输出，比如概念说明、题型策略、练习模板、常见错误、最小例子
- 对于 12 周计划，应该按“周目标 + 题型模块 + 训练任务”拆，不要只写一个总目标

如果用户给的是雅思、考研、编程、产品、面试这类计划，优先把目标拆成这几类点：

- 周计划点
- 题型/模块策略点
- 高频错误点
- 练习模板点
- 复盘和纠偏点

如果是听力类学习，不要把“找材料、收集音频、整理题源”当成这个 skill 的职责。
这类内容默认由用户自己提供，skill 只负责把用户已有材料拆成可执行的学习点，并用 CLI 记录学习和复习状态。

具体示例见 `references/english/ielts-12-week-plan.md`。

当前已经实现：

- `goal init`
- `goal show`
- `point add`
- `point list`
- `point show`
- `study start`
- `study done`
- `review check`
- `review done`
- `index rebuild`
- `validate`
- `stats`

当前还没实现：

- `point open`
- `point remove`
- `point rename`
- `study mastery`
- `study pause`
- `study resume`
- `review log`
- `relate list/add/remove/check`
- `index status`
- `stats weak`
- `doctor`

如果用户要的是“暂未实现”的命令：

1. 先明确说明 CLI 现在还不支持这个动作
2. 如果当前任务仍然必须完成，再退回到手工改文件
3. 手工改动后必须保持路径推导 ID、frontmatter 字段、review 日志约定一致
4. 改完必须跑 `./bin/learn validate <goal-path>`

## 强约束

### 1. 能用 CLI 写，就不要手改

如果已经存在对应 `learn` 命令，优先使用命令，不要直接改 frontmatter。

例如：

- 用 `study done` 更新 `mastery`
- 用 `review done` 更新 `lastReviewedAt`、`nextReviewAt`、`reviewCount` 并追加 `review-log.jsonl`
- 用 `point add` 新建知识点文件

### 2. 重要操作前后都要校验

如果是在一个已有 goal 上做比较实质性的修改，先看当前状态：

```bash
./bin/learn goal show <goal-path>
./bin/learn point list <goal-path>
```

任何写操作之后，优先执行：

```bash
./bin/learn validate <goal-path>
```

如果这次操作影响了知识点数量或知识点状态，也要确保：

```bash
./bin/learn index rebuild <goal-path>
```

注意：当前大多数写命令已经会自动重建 index，但在修复不一致状态时，显式重建仍然是合理的。

### 3. 同一个 goal 上的写操作要串行

不要对同一个 goal 同时并发执行多个写命令，尤其是这些组合：

- `goal init` 和后续 `point add`
- `study done` 和 `review done`
- `review done` 和紧跟着的读操作

原因很简单：

- 当前 CLI 会在写后重建 index
- 并发读写同一个 goal 时，读命令可能看到旧状态
- 并发写入会让验证结果不稳定

默认做法是串行执行，必要时先写完再读。

### 4. 严格尊重 source of truth

主数据是：

```txt
points/**/*.md
```

这意味着：

- 不能把 `.learn/index.json` 当成比 point frontmatter 更权威的数据源
- 不能只改 index，不改 point 文件
- 不能通过覆写旧记录的方式修改 `.learn/review-log.jsonl` 历史

### 5. ID 必须由路径推导

如果知识点文件路径是：

```txt
points/html/semantic/article-aside.md
```

它的 ID 就必须是：

```txt
html.semantic.article-aside
```

规则：

- 去掉 `points/`
- 去掉 `.md`
- `/` 替换成 `.`

### 6. frontmatter 类型不能乱

point frontmatter 里：

- `tags` 和 `relate` 是数组
- `lastStudiedAt`、`lastReviewedAt`、`nextReviewAt` 可以为空
- `createdAt` 和 `updatedAt` 是 `YYYY-MM-DD`
- review 相关时间字段是 RFC3339

不要把可空时间字段写成数组、占位对象或别的结构。

## 推荐操作流程

### 初始化新目标

```bash
./bin/learn goal init <goal-path>
./bin/learn goal show <goal-path>
./bin/learn validate <goal-path>
```

### 新增知识点

```bash
./bin/learn point add <goal-path> <domain/.../slug>
./bin/learn point show <goal-path> <pointId>
./bin/learn validate <goal-path>
```

### 完成一次学习

```bash
./bin/learn study start <goal-path> <pointId>
./bin/learn study done <goal-path> <pointId> --mastery <0-5>
./bin/learn point show <goal-path> <pointId>
./bin/learn validate <goal-path>
```

### 完成一次复习

```bash
./bin/learn review check <goal-path>
./bin/learn review done <goal-path> <pointId> --grade good --note "<short note>"
./bin/learn point show <goal-path> <pointId>
./bin/learn validate <goal-path>
```

### 汇总当前进度

```bash
./bin/learn goal show <goal-path>
./bin/learn stats <goal-path>
./bin/learn point list <goal-path>
```

## 需要查看哪些文件

如果需要理解实现细节，优先看：

- `src/README.md`
- `src/cli.ts`
- `src/learn.ts`
- `src/frontmatter.ts`
- `docs/learn-command-spec.md`
- `templates/learnspace/schemas/*.json`
- `references/english/ielts-12-week-plan.md`
- `prompts/english-coach-system-prompt.md`

## 响应方式

使用这个 skill 时：

- 明确说清楚当前操作的是哪个 `goal-path`
- 需要时说出你实际执行的 `learn` 命令
- 如果 `validate` 失败，先展示真实错误，再决定怎么修
- 如果因为 CLI 尚未支持而必须手工改文件，要明确说明这是退回方案
