---
illustration_id: 01
type: flowchart
style: notion
palette: default
aspect: 3:4
backend_note: code-rendered HTML (exact Chinese + technical labels)
---

ThreadPoolExecutor.execute 决策流程 - Process Flow

Layout: top-down vertical decision tree

STEPS:
1. 提交一个任务（execute） — 流程起点
2. 当前线程数 < corePoolSize ? — 决策菱形
   - 是 → 创建核心线程，直接跑这个任务
   - 否 → 进入下一步
3. 队列没满 ? — 决策菱形
   - 是 → 任务塞进队列排队
   - 否（队列满了）→ 进入下一步
4. 当前线程数 < maximumPoolSize ? — 决策菱形
   - 是 → 创建非核心线程，直接跑这个任务
   - 否（线程也到上限了）→ 执行拒绝策略

CONNECTIONS:
- 垂直主路径：起点 → 三个顺序判断
- 每个判断的「是」向右（或旁支）指向结果节点
- 「否」继续向下进入下一判断
- 最终拒绝策略为强调色终点

COLORS (rendering guidance only — do NOT display hex or color names as text):
- Background: White #FFFFFF / Off-White #FAFAFA
- Primary outlines/text: Near Black #1A1A1A
- Decision diamonds: Pastel Blue #A8D4F0 fill
- Success/action boxes: Pastel Yellow #F9E79F fill
- Queue box: soft Pastel Pink #FADBD8 fill
- Reject strategy: soft coral/pink emphasis
- Yes labels: teal-ish accent if needed; No labels: gray

STYLE: Notion-like minimalist knowledge diagram.
Clean solid white background, maximum whitespace, soft pastel fills,
rounded rectangles for actions, diamonds for decisions, clear yes/no branch labels,
simple geometric icons (thread, queue, reject) optional and minimal.
Large readable Chinese sans-serif labels. No clutter, no gradients, no shadows.
Clean composition with generous white space.

LABELS (must match exactly):
- 提交一个任务（execute）
- 当前线程数 < corePoolSize ?
- 创建核心线程，直接跑这个任务
- 队列没满 ?
- 任务塞进队列排队
- 当前线程数 < maximumPoolSize ?
- 创建非核心线程，直接跑这个任务
- 执行拒绝策略
- 是 / 否

ASPECT: 3:4 (portrait flowchart)
Clean composition with generous white space. Simple or no background. Main elements centered.
Text should be large and prominent. Keep minimal, focus on keywords.
Color values (#hex) and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text in the image.
