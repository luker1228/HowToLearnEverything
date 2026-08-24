---
illustration_id: 01
type: comparison
style: warm
---

断路器设计笔记 - Comparison Cover

STRICT LAYOUT, two equal panels, one horizontal pipeline per panel.

TOP full-width:
Hand-lettered title: 断路器设计笔记
Below it: a sliding-window strip of 5 cup-shaped buckets, ALL five with a red X (high error rate). Label left of strip: 窗口错误率. A brown curved arrow from the strip down into the right panel, labeled 触发开启.

LEFT PANEL, header 关闭:
ONE straight horizontal pipeline, three objects in a row, one orange arrow between each:
1) small beige server
2) a large orange toggle SWITCH in the ON/connected position (capsule toggle, knob/fill showing connected) — a simple switch, NOT a breaker panel
3) a terracotta stacked-cylinder database
Arrow labels: 请求
Label under the database: 走数据库
The request MUST go through the switch to reach the database. No bypass arrows.

RIGHT PANEL, header 开启:
ONE straight horizontal pipeline, three objects in a row:
1) the same beige server
2) a dark toggle SWITCH in the OFF/open position (visible crack/gap)
3) a golden-yellow rounded box labeled 降级, containing a small paper card labeled 缓存结果
Arrow label: 请求
Below the switch, a dim terracotta database with a red X and the label 不走数据库. A dashed line from the switch toward that database that is blocked. The live solid arrow goes only to 降级, never to the database.

MEANING:
关闭 = switch connected = go to database.
开启 = switch open = degrade, do not hit database.
Opening is triggered by high error rate in the window.

TEXT, Chinese only, large handwritten: 断路器设计笔记, 窗口错误率, 触发开启, 关闭, 开启, 请求, 走数据库, 降级, 缓存结果, 不走数据库.
No English. No hex codes.

COLORS: Cream (#FFFAF0) background, Warm Orange (#ED8936), Terracotta (#C05621), Golden Yellow (#F6AD55), Deep Brown (#744210), Soft Red (#E53E3E) for errors only. Color values (#hex) and color names are rendering guidance only — do NOT display color names, hex codes, or palette labels as visible text in the image.

STYLE: Warm, friendly illustration. Rounded shapes, soft corners, soft shadows, hand-drawn quality. Clean composition with generous white space.

ASPECT: 16:9
