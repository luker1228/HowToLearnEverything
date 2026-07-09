---
name: learn-cli
description: 当用户要先定义英语教练 system prompt，再生成英语学习 plan，并最终用本仓库的 learn CLI 固化和追踪该 plan 状态时使用。
metadata:
  short-description: 英语学习的 prompt-plan-cli 工作流
---

# Learn CLI Skill

当用户要为英语学习建立一套 `system prompt -> plan -> CLI 状态追踪` 工作流时，使用这个 skill。

这套 skill 服务的是当前仓库里的 Learning Point Spec：

- 一个目标 = 一个文件夹
- 一个知识点 = 一个 Markdown 文件
- 知识点 frontmatter 是知识点状态的唯一主数据
- `.learn/index.json` 是可重建索引
- `.learn/review-log.jsonl` 是追加式事件日志
- 支持的写入口优先是 `./bin/learn`

## 三部分模型

这个 skill 明确分成三部分：

### 1. 系统提示词

这一层定义英语教练如何工作，不直接产出计划。

它负责：

- 教练人设
- 互动语言
- 课程节奏
- 纠错策略
- 输出格式
- 每节课的固定结构

参考文件：

- `prompts/english-coach-system-prompt.md`

### 2. 计划生成

这一层基于 `system prompt` 产出具体学习计划。

它负责：

- 12 周目标
- 每周重点
- 每天 1 小时如何分配
- 模块拆分
- 具体知识点列表
- 哪些内容由用户自己提供材料
- 哪些内容需要进入 CLI 跟踪

参考文件：

- `prompts/english-plan-generator-prompt.md`
- `references/english/ielts-12-week-plan.md`

### 3. CLI 固化

这一层只负责把 plan 落成状态系统。

CLI 只关心：

- 当前有哪些 goal 和 point
- 每个 point 现在是什么状态
- 哪些点学过了
- 哪些点需要复习
- 数据结构是否合法

CLI 不负责：

- 设计课程
- 生成教学内容
- 替用户决定计划质量
- 生成听力材料

## 何时使用

当用户要做下面这些事情时，触发这个 skill：

- 定义或调整英语教练 `system prompt`
- 基于 `system prompt` 生成英语学习 plan
- 把学习计划拆成可执行 point
- 用 CLI 初始化一个新的英语学习 goal
- 新增或查看一个知识点
- 开始学习某个知识点
- 完成一次学习并更新掌握度
- 检查哪些知识点需要复习
- 记录一次复习结果
- 校验某个 goal 目录是否合法
- 汇总学习进度、状态分布、复习情况

下面这些场景不要使用这个 skill：

- 普通 wiki 维护
- 不属于英语学习工作流的任意 Markdown 编辑
- 在 CLI 已支持的前提下，直接手工修改 point frontmatter
- 让 CLI 替代 plan 设计

## 核心边界

要始终坚持这个边界：

- `prompt` 负责教学行为
- plan 负责学习内容
- CLI 负责状态固化

这意味着：

- 不要用 CLI 代替计划设计
- 不要让 point frontmatter 承担长篇课程设计文档
- `goal.md` 只概括目标、节奏、范围
- 详细计划可以先作为 plan 文档存在，再映射到 points

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

1. 先明确说明 CLI 现在还不支持这个动作。
2. 如果当前任务仍然必须完成，再退回到手工改文件。
3. 手工改动后必须保持路径推导 ID、frontmatter 字段、review 日志约定一致。
4. 改完必须跑 `./bin/learn validate <goal-path>`。

## Plan 拆解原则

当用户给的是“学习目标”而不是已经拆好的知识点时，不要只停留在目标层面。

正确顺序是：

1. 先定义或确认 `system prompt`。
2. 用 `system prompt` 生成具体 plan。
3. 再把 plan 拆成可执行的 point 列表。
4. 最后用 CLI 固化这些 point 的状态。

判断一个 point 是否合格：

- 有明确的知识边界
- 能在 1 次学习里完成一个小闭环
- 能支持解释、练习、自测和复习
- 最好对应 1 个清晰输出，比如策略说明、模板、常见错误、最小例子

对于 12 周英语计划，优先按这些维度拆：

- 周计划点
- 模块策略点
- 高频错误点
- 表达模板点
- 复盘和纠偏点

如果是英语考试或英语能力提升计划，尤其要区分：

- 用户自己提供的输入材料
- 需要进入 CLI 跟踪的学习点

如果是听力类学习，不要把“找材料、收集音频、整理题源”当成这个 skill 的职责。
这类内容默认由用户自己提供，skill 只负责把已有材料拆成可执行的学习点，并用 CLI 记录学习和复习状态。

具体示例见 `references/english/ielts-12-week-plan.md`。

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

### 先定义教练

先查看或使用：

- `prompts/english-coach-system-prompt.md`

### 再生成计划

用这些参考来生成 plan：

- `prompts/english-plan-generator-prompt.md`
- `references/english/ielts-12-week-plan.md`

### 再固化状态

```bash
./bin/learn goal init <goal-path>
./bin/learn point add <goal-path> <domain/.../slug>
./bin/learn study start <goal-path> <pointId>
./bin/learn study done <goal-path> <pointId> --mastery <0-5>
./bin/learn review check <goal-path>
./bin/learn review done <goal-path> <pointId> --grade good --note "<short note>"
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
- `prompts/english-coach-system-prompt.md`
- `prompts/english-plan-generator-prompt.md`
- `references/english/ielts-12-week-plan.md`

## 响应方式

使用这个 skill 时：

- 明确说清楚当前处于哪一层：`prompt`、`plan`、还是 `CLI`
- 明确说清楚当前操作的是哪个 `goal-path`
- 需要时说出你实际执行的 `learn` 命令
- 如果 `validate` 失败，先展示真实错误，再决定怎么修
- 如果因为 CLI 尚未支持而必须手工改文件，要明确说明这是退回方案
