# AGENTS.md — TypeScript x Learn Claude Code Workspace

## 这是什么

这是一个用于学习 `https://learn.shareai.run/zh/` 的 TypeScript 实战仓库。

目标不是只“看懂”课程，而是用 TypeScript 把课程里的 agent harness 机制逐步重建出来。

当前阶段：

- `lesson:01`：TypeScript 基础
- `lesson:02`：对应站点 `s01 Agent Loop`

## 当前目标

学习顺序固定为两条线并行：

1. 学 `learn.shareai.run/zh` 的 agent 机制
2. 用严格模式 TypeScript 实现这些机制

判断标准不是“能跑就行”，而是：

- 类型是否精确
- 数据结构是否清晰
- 运行时边界是否明确
- 代码是否方便继续演进到下一课

## 命令

```sh
npm install
npm run dev
npm run lesson:01
npm run lesson:02
npm run typecheck
npm run build
```

## 文件结构

```text
README.md                     - 仓库入口说明
AGENTS.md                     - 本协作文档
docs/ts-shareai-study-plan.md - 学习路线与阶段目标
src/index.ts                  - 本地学习入口
src/lessons/01-types.ts       - TypeScript 基础练习
src/lessons/02-agent-loop.ts  - s01 Agent Loop 的 TypeScript 版本
```

## 协作规则

- 默认把这个仓库当成“课程实验场”，不是生产项目
- 每次只引入一个新机制，避免一下子把多层抽象堆进去
- 严禁用 `any` 跳过问题；优先用 `unknown`、narrowing、union、`satisfies`
- 新增课程时，必须能回答两个问题：
  1. TypeScript 在这里帮我们保证了什么？
  2. 运行时还有什么是 TypeScript 保证不了的？

## 实现原则

- 优先写最小但完整的例子
- 先把数据结构写对，再讨论抽象复用
- 先用同步/模拟版本讲清机制，再逐步引入真实 IO、异步和权限
- 示例代码要能直接运行和 typecheck

## 下一步课程映射

- `lesson:03` → `s02 Tool Use`
- `lesson:04` → `s03 Permission`
- `lesson:05` → `s04 Hooks`
- 后续再进入规划、记忆、并发、多 agent

## 对协作 agent 的要求

- 如果修改课程代码，先保持 lesson 可运行，再补解释
- 如果新增 lesson，必须同步更新 `README.md`
- 如果学习路径变化，必须同步更新 `docs/ts-shareai-study-plan.md`
- 回答问题时，优先结合当前 lesson 文件，不要脱离仓库空谈理论
