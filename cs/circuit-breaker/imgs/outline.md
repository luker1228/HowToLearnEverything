---
type: comparison
density: minimal
style: warm
palette: default
image_count: 1
language: zh
backend: image_gen
---

## Illustration 1
**Position**: 文章开头(封面)
**Purpose**: 讲清熔断器本质：它是一个开关；关闭走数据库，开启走降级；开启由窗口内错误率触发
**Visual Content**: 左右对比。左「关闭」：拨杆开关接通，请求走向数据库。右「开启」：开关断开，请求改走「降级」兜底、不打数据库。顶部滑动窗口（红错标记）标「窗口错误率 → 触发开启」
**Filename**: 01-scene-circuit-breaker-shield.png
