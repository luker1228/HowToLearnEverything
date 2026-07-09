# 雅思 12 周英语学习计划示例

这个示例用于说明：当用户说“我要做 12 周雅思学习计划，每天 1 小时”时，skill 应该如何把它拆成可执行的 `goal` 和 `point`。

## 1. Goal 层

目标不要只写成“12周雅思学习计划”，而要写成可执行的 goal 说明。

注意：

- 听力材料的收集和选题不属于这个 skill 的职责
- 听力部分默认使用用户自己提供的材料
- 这个 skill 只负责把已有材料对应的学习任务拆成 point，并记录学习状态

推荐目录：

```txt
/private/tmp/ielts-12-week-plan/
  goal.md
  points/
    listening/
      section-strategy.md
      trap-words.md
      map-form-note.md
    reading/
      skimming-vs-scanning.md
      heading-matching.md
      true-false-not-given.md
    writing/
      task1-overview.md
      task1-comparison.md
      task2-argument-structure.md
    speaking/
      part1-basic-answer.md
      part2-story.md
      part3-deepening.md
    review/
      week-01-review.md
      week-04-review.md
      week-08-review.md
      week-12-mock.md
```

goal.md 应该表达：

- 备考目标
- 每天 1 小时的学习节奏
- 四科优先级
- 每周复盘节奏
- 模考节点

## 2. 点位拆分原则

不要只建“听力”“阅读”“写作”“口语”四个大点。

要拆到具体知识点，例如：

- `listening/section-strategy`：section 内题型处理顺序
- `listening/trap-words`：容易混淆的词和干扰项
- `reading/skimming-vs-scanning`：略读和扫读
- `reading/true-false-not-given`：判断题策略
- `writing/task1-overview`：小作文 overview 写法
- `writing/task2-argument-structure`：大作文论证结构
- `speaking/part2-story`：part 2 叙事模板

每个 point 应该能在 Markdown 里填出这些内容：

- 一句话解释
- 核心概念
- 为什么重要
- 常见误区
- 最小例子
- 基础练习
- 应用练习
- 自我提问

## 3. 每天 1 小时的落法

推荐把一天的 1 小时拆成三个动作：

```txt
20 分钟学习新点
20 分钟做练习
20 分钟回顾旧点或做 review
```

实际执行时：

```bash
./bin/learn review check /private/tmp/ielts-12-week-plan
./bin/learn study start /private/tmp/ielts-12-week-plan listening.section-strategy
./bin/learn study done /private/tmp/ielts-12-week-plan listening.section-strategy --mastery 2
./bin/learn review done /private/tmp/ielts-12-week-plan listening.section-strategy --grade good --note "能复述 section strategy"
./bin/learn validate /private/tmp/ielts-12-week-plan
```

## 4. 12 周节奏示例

### 第 1-4 周

- 建立基础题型知识点
- 完成听说读写的最小策略点
- 记录常见错误
- 听力材料由用户自行准备，不在 skill 中处理

### 第 5-8 周

- 强化题型训练
- 形成写作和口语模板
- 增加 review 密度

### 第 9-12 周

- 做整套模拟
- 纠偏高频错误
- 回收弱点点位，提升 mastery

## 5. 适合创建的 point 示例

```bash
./bin/learn point add /private/tmp/ielts-12-week-plan listening/section-strategy
./bin/learn point add /private/tmp/ielts-12-week-plan reading/true-false-not-given
./bin/learn point add /private/tmp/ielts-12-week-plan writing/task2-argument-structure
./bin/learn point add /private/tmp/ielts-12-week-plan speaking/part2-story
./bin/learn point add /private/tmp/ielts-12-week-plan review/week-04-review
```

## 6. 不推荐的拆法

不要只做这类点：

- `ielts`
- `listening`
- `reading`
- `writing`
- `speaking`

这些点太大，不能支持每天 1 小时的学习闭环，也不利于 `review check` 挑出真正该复习的知识点。
