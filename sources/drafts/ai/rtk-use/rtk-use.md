---
---
# RTK：用 Rust 重构你的 CLI 工具，让 CodeBuddy的 token 消耗降低 90%

## 背景：token 消耗之痛

最近在使用 AI 编程助手时，发现 token 消耗量异常惊人。一个小时的编程会话，竟然能消耗十几万甚至二十万 token。仔细分析后发现，很多常见的命令行工具输出占据了大量的上下文：

- `git status` 输出冗长的文件列表和状态
- `grep` 在大项目中搜索结果成百上千行
- `jq` 处理大型 JSON 时输出过多细节
- 测试框架的输出包含大量成功的测试用例
- 构建日志中充斥着重复的警告和注释

这些输出对于 AI 理解问题并非全部必要，但却占用了宝贵的 token 配额。直到有一天，我发现了 **rtk** 这个工具。

## RTK 是什么？

[rtk](https://github.com/rtk-ai/rtk) 是一个用 Rust 编写的高性能 CLI 代理工具。它的核心功能是在命令行输出到达 LLM 上下文之前，对其进行智能过滤和压缩。根据官方数据，它能将 token 消耗降低 **60% 到 90%**。

这是一个典型的"用正确工具解决正确问题"的案例。rtk 并不是要替代现有的 CLI 工具，而是在它们和 AI 之间加一层"翻译器"，让输出更符合 AI 的阅读习惯。

## 工作原理

rtk 的核心设计非常巧妙——它作为一层代理，拦截 CLI 命令的原始输出，经过智能处理后再发送给 AI。以下是对比：

**Without rtk：**
```
Claude  --git status-->  shell  -->  git
  ^                            |
  |        ~2,000 tokens (raw) |
  +----------------------------+
```

**With rtk：**
```
Claude  --git status-->  RTK  -->  git
  ^                      |          |
  |   ~200 tokens        | filter   |
  +------- (filtered) ---+----------+
```

可以看到，rtk 插入在 AI 和 shell 之间，对每个命令的输出进行过滤处理后再传递给 AI。对于 `git status` 这类命令，token 消耗从约 2000 tokens 骤降到约 200 tokens，效果显著。

## 实际使用的例子
这里找一个对比比较强烈的例子

**git log -n 10**

```
commit e5bb4e106bd8bdf24420c6731786150ab1a4026f (HEAD -> main)
Author: lukemxjia <lukemxjia@qqqq.com>
Date:   Thu Mar 19 16:53:08 2026 +0800

    fix system role not found

commit 0db3a2d76a1026cde08436decec6e9993e04a4ea
Author: lukemxjia <lukemxjia@qqqq.com>
Date:   Thu Mar 19 16:47:47 2026 +0800

    fix sqlc logical fk

commit 038b40d19163b17c9c910caa5a5d675adbcf7581 (origin/main, origin/HEAD)
Author: lukemxjia <lukemxjia@qqqq.com>
Date:   Thu Mar 19 15:56:46 2026 +0800

    feat(db): 更新 sqlc 生成的数据库代码

commit ff26e6c0132004c4dc5bd207353889e5f41a7d28
Author: lukemxjia <lukemxjia@qqqq.com>
Date:   Thu Mar 19 15:36:15 2026 +0800

    refactor(organization): 使用组织名称作为主键，移除 org_id

commit 01588263ecd553cfc70740d50db13f1f516280e0
Author: lukemxjia <lukemxjia@qqqq.com>
Date:   Thu Mar 19 00:51:20 2026 +0800

    feat(logical_fk): 添加 model_name 和 ref_model_name 字段

commit 9c5cf45bf0318ae29957e678abd5ccfcdd2900a5
Author: lukemxjia <lukemxjia@qqqq.com>
Date:   Wed Mar 18 00:53:13 2026 +0800
```

**rtk git log -n 10**
```
e5bb4e1 fix system role not found (7 hours ago) <lukemxjia>
0db3a2d fix sqlc logical fk (7 hours ago) <lukemxjia>
038b40d feat(db): 更新 sqlc 生成的数据库代码 (8 hours ago) <lukemxjia>
ff26e6c refactor(organization): 使用组织名称作为主键，移除 org_id (8 hours ago) <lukemxjia>
0158826 feat(logical_fk): 添加 model_name 和 ref_model_name 字段 (23 hours ago) <lukemxjia>
9c5cf45 docs: 添加 jq 工具文档并优化字段加载 (2 days ago) <lukemxjia>
c94c74e docs: 更新工具文档从 Task 迁移到 just (6 days ago) <lukemxjia>
ccae202 feat(schema): 添加主键字段冲突检测 (6 days ago) <lukemxjia>
d0acda6 feat: 为 Field 添加 isDeprecated 字段 (6 days ago) <lukemxjia>
c9bbec3 refactor(db): 统一数据库管理命令 (6 days ago) <lukemxjia>
```

## 具体原理
就是利用hooks的机制。  
只要你的工具支持hook，在调用前就会拦截命令。使用rtk就可以帮你节省token
```
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/root/.codebuddy/hooks/rtk-rewrite.sh"
          }
        ]
      }
    ]
  },
```
参考 https://www.codebuddy.cn/docs/cli/hooks-guide#%E8%87%AA%E5%AE%9A%E4%B9%89%E9%80%9A%E7%9F%A5-hook 自行配置

最后使用 `rtk gain` 就可以查看自己节省了哪些token。即使程序员，也要勤俭持家过日子。
