---
article: cs/classic/java-thread-pool-from-new-thread-to-threadpool-executor.md
request: 封面图（故障态：旁路拖垮核心）
type: scene
density: minimal
style: sketch-notes
palette: default (sketch-notes 暖奶油 + 黑手绘线 + 柔和粉彩块)
image_count: 1
language: zh
backend: image_gen (runtime native Imagine)
---

## Illustration 1（封面）
**Position**: 文章顶部，作为封面图（位于标题之下、第一节 `# 一、全景` 之前）。
**Purpose**: 一眼讲清标题主题——旁路慢任务把**共享业务线程池**占满，从而**拖垮**核心业务。画的是故障态，不是 Bulkhead 修好后的隔离态。
**Visual Content**: 暖奶油纸手绘 sketch-notes。
  - 画面中心只有**一个**共享圆池，标签「共享业务线程池」；没有中间舱壁、没有左右分池。
  - 池内被珊瑚红「旁路慢任务」占满：大齿轮、3–5min 任务块、火、烟、警报；worker 全被慢活占用。
  - 红液/任务从池沿溢出，用粗绳/粗箭头或溢出洪水体现「拖垮」因果——直接拽住/淹没「核心请求」。
  - 核心请求（薄荷绿/淡蓝小箭头）堵在池外进不去；火柴人慌乱、大 ✕，情绪是饿死/被拖死。
  - 旁路源头可有 Kafka 式多箭头涌入，强调量放大。
**Filename**: 01-comparison-bulkhead-isolation.png
