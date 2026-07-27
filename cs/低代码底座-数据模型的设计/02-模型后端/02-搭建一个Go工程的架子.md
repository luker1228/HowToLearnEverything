---
title: "ModelCraft：02-AI时代的Go工程最佳实践——代码框架篇"
description: "从日志门面、业务错误、DDD 分层到可观测性，讨论 AI 时代第一版 Go 工程架子应该怎么搭。"
pubDate: 2026-06-24
updatedDate: 2026-06-24
series: "ModelCraft"
tags:
  - "modelcraft"
  - "go"
  - "architecture"
  - "observability"
  - "engineering"
---
![](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/AI%E6%97%B6%E4%BB%A3Go%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5-%E4%BB%A3%E7%A0%81%E6%A1%86%E6%9E%B6.png)
# ModelCraft：02-AI时代的Go工程最佳实践——代码框架篇

## 背景
**经过我自己无数的踩坑，我分享一般非常务实的AI时代最佳工程实践**

之前有小伙伴问过我， 他的项目最开始的时候，AI完成的非常出色。但是当代码变多， 业务开始复杂的时候。就有点收不住了。项目开始变的有点难以维护了。

今天来教大家如何结合AI coding 来完成这件事情

所有的目的其实只围绕一件事情展开——即如何打日志展开。主要是给你的项目提供可观测性，从而让AI实现自我闭环。

## 先说结论：第一版工程架子应该长什么样

我个人更推荐第一版就把目录按职责切开，大概像这样：

```text
.
├── cmd/server
│   └── main.go
├── internal
│   ├── app
│   │   └── user
│   │       ├── service.go
│   │       └── service_test.go
│   ├── domain
│   │   └── user
│   │       ├── entity.go
│   │       ├── errors.go
│   │       ├── repository.go
│   │       └── service.go
│   ├── infrastructure
│   │   ├── db
│   │   │   └── mysql.go
│   │   ├── logging
│   │   │   └── logger.go
│   │   ├── observe
│   │   │   ├── metrics.go
│   │   │   ├── tracer.go
│   │   │   └── middleware.go
│   │   └── repository
│   │       └── user_repo.go
│   └── interfaces
│       ├── graphql
│       │   └── user_handler.go
│       └── http
│           └── user_handler.go
├── pkg
│   └── bizerrors
│       └── business_error.go
└── go.mod
```

![Go工程第一版分层结构](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/01-framework-go-project-structure.png)

这里提一句：这里我在最开始的时候，项目的搭架子初期，我比较推荐直接用SDD， 我在做比较大的东西的时候， 都会提前使用SDD。这里也不是说强模型弱模型的区分，我单纯的是不希望在这个阶段，让AI发挥创造力。我要的是一个可控的架子。而且类似superpower有brainstorm的功能。这里很容易让AI帮你完成调研。让你去想一些你之前可能忘记想的功能。

## 1. 如何做一个日志门面

解决什么问题：
1. 屏蔽具体的日志实现细节。 不要在业务里直接依赖具体日志库
2. **统一日志格式**。通过包装的方式，保证AI使用同一格式的日志。
3. 增强对error即错误的处理。 

这里我只想说一点。做日志门面的最大好处，就是让你的日志规范, 统一日志格式。看起来是很小的一件事情，但是这个事情决定了你Vibecoding的下限。可以无限提升你Vibecoding后面遇到Harness工程的事情。

> 比如有些人喜欢zaplog这样打日志。 log.Infow
> 有些人喜欢这样。 log.Infof
> 在我这里统统没有，只有一种格式。Infof。即日志里所有的key， 被我强行约束在一个有限集下了。 不会出现， 一会儿requestId， 一会儿reqId， 一会儿requestid 这种问题。

### 为什么不要在业务里直接依赖具体日志库

其实我不想解释为什么日志要做一个门面。我可以这么说。作为最流行的语言Java，他保持了这个设计。所以做一个日志的门面模式非常重要。

很多 Go 项目会直接在代码里写：

```go
import "go.uber.org/zap"

func (s *Service) Query(ctx context.Context) error {
    zap.L().Info("query start")
    return nil
}
```

短期看没问题，长期问题很大：

1. 业务代码直接绑死了 `zap`。虽然说， 这里绝大多数人会对这一点嗤之以鼻， 觉得很难遇到这个问题。 但是，我觉得有选择，总比没选择强。
2. 以后想切 `slog`、想补字段规范、想加 trace_id，很难统一改
3. 第三方库输出格式和业务日志格式不一致

![日志门面怎么把上下文和堆栈收住](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/02-framework-log-facade-flow.png)

### 一个足够实用的日志接口

结合我自己在 `a-clean-go-demo/pkg/logfacade` 里的落地，我现在更推荐把接口收敛成统一的 `f` 风格：

> 学习用代码入口：[`luker1228/a-clean-go-demo/tree/master/pkg/logfacade`](https://github.com/luker1228/a-clean-go-demo/tree/master/pkg/logfacade)
> （ModelCraft 是最终落地，建议先从 a-clean-go-demo 这个最小可跑的 demo 看起）

```go
package logfacade

import "context"

type Logger interface {
    Debugf(ctx context.Context, format string, args ...any)
    Infof(ctx context.Context, format string, args ...any)
    Warnf(ctx context.Context, format string, args ...any)
    Errorf(ctx context.Context, err error, format string, args ...any)
    Fatalf(ctx context.Context, err error, format string, args ...any)

    With(fields ...Field) Logger
    Sync() error
}
```

这里几个点值得注意：

1. 普通日志统一走 `Debugf/Infof/Warnf`
2. 错误日志统一走 `Errorf(ctx, err, format, args...)`
3. `With` 只负责预附加结构化字段
4. `Sync` 负责进程退出前刷盘

为什么一定要带 `context`？

因为后面你真正想要的不是“能打印日志”，而是：

```text
这条日志能自动带上 trace_id、request_id、user_id、model_id
```

没有 `context`，后面这些上下文信息根本接不进去。

### 用 zap 做底层实现，但业务层不要感知

我自己的做法是对外只暴露 `logfacade.Logger`，底层当前用 `zap` 承接：

```go
package logfacade

import (
    "context"
    "fmt"

    "go.uber.org/zap"
)

type ZapLogger struct {
    logger *zap.Logger
}

func (z *ZapLogger) Infof(ctx context.Context, format string, args ...any) {
    if ctx == nil {
        ctx = context.Background()
    }
    msg := fmt.Sprintf(format, args...)
    z.logger.Info(msg, z.extractContextFields(ctx)...)
}

func (z *ZapLogger) Errorf(ctx context.Context, err error, format string, args ...any) {
    if ctx == nil {
        ctx = context.Background()
    }
    msg := fmt.Sprintf(format, args...)
    fields := z.extractContextFields(ctx)
    fields = append(fields, z.extractErrFields(err)...)
    z.logger.Error(msg, fields...)
}
```

这里做了两件事：

1. 所有业务日志都统一变成 printf 风格消息
2. 从 `ctx` 里提取 `request_id`，从 `err` 里自动提取 `stack`

这样业务代码里就很干净：

```go
repoLogger := logger.With(
    logfacade.String("component", "model-repo"),
    logfacade.String("model_id", model.ID),
)

repoLogger.Infof(ctx, "build graphql schema: field_count=%d", len(model.Fields))
```

如果有错误，也不需要手工 `With(err)`：

```go
repoLogger.Errorf(ctx, err, "build graphql schema failed: field_count=%d", len(model.Fields))
```

`Errorf` 内部直接把 `stack` 结构化打出来。

> 这里 `Errorf` 的设计其实是有些小巧思在的，后面会专门展开。详情可以看后面的 `### 如何打错误日志`。

### 如何打错误日志

我有个暴论。 所有错误日志必须打堆栈信息。 没必要节省。

所以我的设计是**把规范做进硬签名里**。可以看下Errorf接口的签名

你不能指望每个人都记得： 错误日志要补堆栈。 当发生线上问题， 但是你确没有堆栈信息时。我想大家一定可以理解我这种感觉。

#### 先定一个硬约束：业务里默认不用标准库 `errors`

这里有一个我自己后来非常坚定的取舍：

**在业务代码里，我默认用 `pkgerrors "github.com/pkg/errors"`，也就是 [pkg/errors](https://github.com/pkg/errors)，而不是标准库 `errors`。**

原因很简单，标准库在进行%+v的时候， 不会输出堆栈

前面已经把日志统一成：

```go
logger.Errorf(ctx, err, "create model failed: model_id=%s", modelID)
```

那接下来一个很现实的问题就是：

**这里的 `err` 需要带出“错误发生点的堆栈”**

标准库的err是不携带堆栈的。 所以这里用了第三方库。

> 很难想象，当时我接手一个服务的时候，线上出问题了，结果发现没有堆栈。线上日志少的可怜，error的关键字还没有特征。只能发一遍新服务再去请求客户重新触发排查日志。还好是vip级别不高的客户。
> 所以我现在对这件事的态度非常坚决：

**堆栈不是可选增强项，而是错误日志的默认配置。**


如何约束呢？
直接不允许在业务包内引入errors包。只能引入我定义的bizerrors。做成了rule。

```go
package bizerrors

import (
	stderrors "errors" // 标准库重命名

	pkgerrors "github.com/pkg/errors"
)

// 完全替换标准库 errors
// 对外暴露的接口保持与标准库一致
var (
	New       = pkgerrors.New
	Errorf    = pkgerrors.Errorf
	Wrap      = pkgerrors.Wrap
	Wrapf     = pkgerrors.Wrapf
	WithStack = pkgerrors.WithStack
	Cause     = pkgerrors.Cause
	Is        = pkgerrors.Is
	As        = pkgerrors.As
	Unwrap    = pkgerrors.Unwrap
)

// 禁止使用标准库
var _ = stderrors.New // 仅用于类型检查

```



这样三件事就串起来了：

1. `bizerrors` 负责把堆栈挂在错误对象上
2. `logfacade.Errorf` 负责把 `error + stack` 自动结构化输出
3. 排查线上问题时，不需要再手工猜错误是从哪一层冒出来的

比如：

```go
func (s *Service) CreateModel(ctx context.Context, input CreateModelInput) error {
    if input.Name == "" {
        return bizerrors.WrapError(nil, bizerrors.InvalidArgument, "model name is required")
    }

    if err := s.repo.Create(ctx, input); err != nil {
        return bizerrors.WrapError(err, bizerrors.SystemError, "Service.CreateModel")
    }

    return nil
}
```

到了接口层或者应用层，只要：

```go
if err != nil {
    logger.Errorf(ctx, err, "create model failed: model_name=%s", input.Name)
    return err
}
```

错误文本、包装链路、堆栈信息就都在了。

这也是为什么我会说：**错误设计不是独立问题，它必须和日志设计一起看。**

## 2. 如何设计业务错误

很多人经常忽略错误的设计。总是不管什么错误都抛出去一个参数错误。一个好的错误设计，让你能够通过错误类型统计，就能判断出你的业务系统是否运行正常。

![bizerrors 怎么把底层错误翻译成稳定语义](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/03-framework-bizerrors-layering.png)

### 错误码：字符串还是数字

字符串而不是数字。 数字比字符串多一层映射。比如1000001和InvalidParam。孰优孰劣一眼看出。


### 错误码本身也要有层次
错误码是字符串，而不是数字。 数字本身信息量低，还得再看一层映射表才能知道错误含义。 在做统计，日志观察，告警观测处理起来都麻烦。

第一层我一般倾向于是什么错误。第二层则是什么领域。 当不知道第二层的领域的时候，对第一层也没有影响
- `NOT_FOUND`
- `NOT_FOUND.MODEL`
- `CONFLICT.MODEL`
- `PARAM_INVALID.AUTH`
- `OPERATION_FAILED.MODEL.READONLY`

这种设计的好处很直接：

1. 上层可以先按大类处理，比如 `NOT_FOUND`、`CONFLICT`
2. 具体场景又能继续细分到模型、字段、项目、认证
3. HTTP / GraphQL 边界层既能做粗粒度映射，也能保留细粒度语义

这比单纯维护一堆离散错误码更适合长期演化。

### 实用的错误设计举例

> 学习用代码入口：[`luker1228/a-clean-go-demo/tree/master/pkg/bizerrors`](https://github.com/luker1228/a-clean-go-demo/tree/master/pkg/bizerrors)
> （ModelCraft 是最终落地，建议先从 a-clean-go-demo 这个最小可跑的 demo 看起）

1. **ErrorDefinition**：定义稳定错误码和消息模板
2. **BusinessError**：在运行时把错误定义、语言、request_id、wrapped error 组装起来

也就是说，不是每次报错都从零拼一个结构体，而是先把“错误定义”沉淀下来。

比如你的 `ErrorDefinition` 大概就是这样：

```go
type ErrorDefinition struct {
    Code      string
    EnMessage string
    ZhMessage string
}
```

然后再基于它构建运行时错误：

```go
type BusinessError struct {
    info         ErrorDefinition
    msg          string
    requestId    string
    language     string
    wrappedError error
}
```

### 一个实用的错误构造方式

```go
func NewError(code ErrorDefinition, params ...any) *BusinessError {
    lang := LangEN
    msg := GetMessageWithParams(code, lang, params)

    return &BusinessError{
        info:     code,
        msg:      msg,
        language: lang,
    }
}

func WrapError(err error, code ErrorDefinition, params ...any) *BusinessError {
    if err == nil {
        return nil
    }

    if bizErr, ok := err.(*BusinessError); ok {
        return bizErr
    }

    bizErr := NewError(code, params...)
    bizErr.wrappedError = err
    return bizErr
}
```

我更喜欢这种写法的原因，不是“封装得优雅”，而是它把最关键的信息强行收束在一个地方：

- `ErrorDefinition` 给稳定语义
- `msg` 给人看
- `wrappedError` 保留原始错误链
- `requestId`、`language` 这种边界信息自动就位

业务里用起来像这样：

```go
/**
{
    "code": "PARAM_INVALID",
    "message": "参数不合法: database_name"
}
  **/
if input.DatabaseName == "" {
    return bizerrors.NewError(bizerrors.ParamInvalid, "database_name")
}

/**
{
    "code": "SYSTEM_ERROR",
    "message": "create model failed"
}
**/
if err := s.repo.Create(ctx, input); err != nil {
    return bizerrors.WrapError(err, bizerrors.SystemError, "create model failed")
}
```



### 把Repo层错误也单独处理

因为 repo 层是最接近数据库、缓存、外部存储的一层。这里拿到的错误，往往已经带有非常强的语义了：

- 主键冲突
- 唯一索引冲突
- 外键约束失败
- 记录不存在
- SQL 超时
- 连接断开

如果你在 repo 层把这些全都糊成一个 `SystemError`，上层虽然拿到了统一错误模型，但会丢掉非常关键的业务判断依据。

如果你向上抛出具体的orm的错误，又会遇到 数据库的不存在和redis的数据不存在是不同的错误。

所以更合理的做法是：

**repo 层负责把“底层存储错误”翻译成“稳定的内部错误语义”。**

还有个好处是，如果你的项目底层orm发生迁移。 这里上层无感知。说白了，还是为了隔离。 比如gorm 和sql的record not found 是不同的错误。 不希望这个错误侵入到其它层，在repo层就被结束。

例如：

```go
func mapDBError(ctx context.Context, err error, modelID string) error {
    if err == nil {
        return nil
    }

    if isDuplicateEntry(err) {
        return bizerrors.WrapError(err, bizerrors.ModelConflict, modelID)
    }

    if isForeignKeyViolation(err) {
        return bizerrors.WrapError(err, bizerrors.ReferenceInvalid, modelID)
    }

    if errors.Is(err, sql.ErrNoRows) {
        return bizerrors.WrapError(err, bizerrors.ModelNotFound, modelID)
    }

    if isTimeoutError(err) {
        return bizerrors.WrapError(err, bizerrors.SystemError, "query timeout")
    }

    return bizerrors.WrapError(err, bizerrors.SystemError, "database operation failed")
}
```

然后 repo 自己只做一层调用：

```go
func (r *MySQLRepository) Insert(ctx context.Context, input modelruntime.InsertInput) error {
    query, args, err := buildInsertSQL(input)
    if err != nil {
        return bizerrors.WrapError(err, bizerrors.SystemError, "build insert sql failed")
    }

    if _, err := r.db.ExecContext(ctx, query, args...); err != nil {
        return mapDBError(ctx, err, input.ModelID)
    }
    return nil
}
```

这样处理以后，收益很明显：

1. app 层不用识别 MySQL error code，也不用碰驱动细节
2. interface 层可以稳定把 `CONFLICT` 映射成 HTTP 409
3. 日志和监控可以直接按业务错误码聚合，而不是按数据库报错文案聚合
4. 后面哪怕从 MySQL 换成 PostgreSQL，上层错误语义也不用跟着改

这里有个边界要注意：

- **repo 可以翻译存储错误**
- **repo 不应该发明业务规则**

什么意思？

像“重复名称不允许创建”，repo 可以把唯一索引冲突翻译成 `CONFLICT.MODEL`；
但“某个角色是否有资格创建模型”，这不是 repo 决定的，这应该在 app / domain 层提前完成。

所以 repo 层的错误处理，本质上也是一种分层：

- 底层错误码、驱动错误、SQLState：留在 repo 内部消化
- 对外暴露的稳定错误语义：交给 `bizerrors`

这一层如果做干净了，后面的 HTTP、GraphQL、日志、告警都会顺很多。


### 加餐：

`mapDBError(...)`，有个问题，就是我的每个repo层都要处理一遍。但是呢，go又没有切面。 ，repo 方法都手写一遍实在是太不极客了。

```go
if err != nil {
    return mapDBError(ctx, err, modelID)
}
```

这种代码写多了以后，问题很快就出来了：

- 重复
- 容易漏
- 不同人写法不一致
- 后面想统一升级错误策略很痛苦

所以我实际采用的是：

**`sqlc + safeQuerier + gowrap`，把错误转换收敛到一层自动处理。**

本质上，这就是一种**切面思想**。

错误转换不是某一个 repo 方法自己的逻辑，而是一种横切关注点。只是 Go 没有 AOP，所以我不是在每个 repo 里手写，也不是靠运行时拦截，而是通过代码生成 `safeQuerier wrapper`，把这层切面织进所有 `sqlc` query 的调用出口。

顺手说一句，我这里说的不是泛指 wrapper 模式，而是 `gowrap` 这个具体技术。

它本质上是一个 **为 Go interface 自动生成 decorator / wrapper 的代码生成工具**。你给它接口和模板，它帮你生成一层显式的 Go 代码，把错误转换、日志、metrics、trace 这类横切逻辑统一织进去。

gowrap仓库地址：
https://github.com/hexdigest/gowrap

核心思路是这样的：

1. `sqlc` 负责根据 SQL 生成类型安全的查询代码
2. 生成出来的 `Queries` 不直接暴露给业务 repo
3. 外面再包一层 `safeQuerier`
4. `safeQuerier` 的每个方法内部统一调用原始 `sqlc` 方法，并在出口统一做错误转换

也就是说，repo 层平时依赖的不是裸 `sqlc.Queries`，而是已经做过安全包装的 querier。

大概会是这个意思：

```go
type Querier interface {
    CreateModel(ctx context.Context, arg db.CreateModelParams) (db.Model, error)
    FindModel(ctx context.Context, id string) (db.Model, error)
}

type SafeQuerier struct {
    raw db.Querier
}

func (q *SafeQuerier) CreateModel(ctx context.Context, arg db.CreateModelParams) (db.Model, error) {
    model, err := q.raw.CreateModel(ctx, arg)
    if err != nil {
        return db.Model{}, wrapQueryError(err, "CreateModel")
    }
    return model, nil
}

func (q *SafeQuerier) FindModel(ctx context.Context, id string) (db.Model, error) {
    model, err := q.raw.FindModel(ctx, id)
    if err != nil {
        return db.Model{}, wrapQueryError(err, "FindModel")
    }
    return model, nil
}
```

真正关键的不是这层 wrapper 长什么样，而是：

**所有 `sqlc` 出口都被统一接管了。**

然后错误翻译逻辑只在一个地方维护：

```go
func wrapQueryError(err error, op string) error {
    if err == nil {
        return nil
    }

    if errors.Is(err, sql.ErrNoRows) {
        return bizerrors.WrapError(err, bizerrors.ModelNotFound, op)
    }

    if isDuplicateEntry(err) {
        return bizerrors.WrapError(err, bizerrors.ModelConflict, op)
    }

    if isForeignKeyViolation(err) {
        return bizerrors.WrapError(err, bizerrors.ReferenceInvalid, op)
    }

    return bizerrors.WrapError(err, bizerrors.SystemError, op)
}
```

这样 repo 代码会干净很多：

```go
func (r *MySQLRepository) Create(ctx context.Context, input modelruntime.CreateModelInput) error {
    _, err := r.querier.CreateModel(ctx, db.CreateModelParams{
        ID:   input.ID,
        Name: input.Name,
    })
    return err
}
```

新增 sqlc query 时，天然进入同一套错误治理体系
后面要补日志、metrics、trace，也可以顺手加在 wrapper 这一层

所以我项目里不是靠工程师自觉，在每个 repo 方法里手写错误转换；
而是通过 **codegen + wrapper**，把这件事做成一个基础设施约束。

这样做的本质，还是那句话：

**不要把规范写在文档里，要把规范写进调用路径里。**

## 3. 为什么要做 DDD 的分层设计

在古法编程时代，我不会推给你DDD的设计。让项目里的每个人认同你的想法这个事情是太难了，每个人有每个人的编程习惯和审美。但是在AI时代，很多adapter代码太廉价了。我强推DDD。至于具体的设计，其实我特别推荐极客时间 钟敬老师的《手把手教你落地DDD》

在我看来DDD的优点是，我的所有逻辑，天然被分层，被隔离了。核心逻辑全部留在domain层，通过95%覆盖率的单测严格锁死，当核心确认后，大部分变化的代码都在应用层。都是一些胶水，流水代码。

这套层与层之间隔离变化的思想，让我的项目在经历几次重构时都收益良多。所以当我阅读别人为什么AI老是该乱工程的时候，我当时特别纳闷，原来我自己已经站在正确的路上。

> 当然，首先得你自己本身认可DDD，了解DDD。才推荐你使用。
### DDD 分层的本质，不是时髦，而是隔离变化

我理解的 DDD 分层，核心不是名词，而是这句话：

**把最容易变化的东西挡在外面，把最核心的规则收在里面。**

对于这个项目来说：

- 最容易变化的是 HTTP、GraphQL、数据库驱动、日志库、监控组件
- 最稳定的核心是模型规则、查询约束、RLS 判定、运行时协议语义

所以理想的依赖方向应该是：

```text
interfaces -> app -> domain
infrastructure -> domain
```

注意：

- `domain` 不应该依赖 `gin`、`gorm`、`mysql driver`
- `domain` 最好也不要关心 GraphQL 的具体对象定义
- `interfaces` 负责把外部协议翻译成内部输入输出
- `infrastructure` 负责把抽象接口落到具体技术实现

### 在这个项目里，各层到底放什么

#### domain 层

这是最高宪法层。

这里放：

- 实体
- 值对象
- 领域服务接口
- 仓储接口
- 领域错误
- 核心规则约束

#### app 层

负责“组织用例”。

它不一定有很重的业务规则，但它会把 domain 能力编排起来。比如：

- 参数校验
- 调 domain service
- 打日志
- 记录 metrics
- 组织事务边界

也就是说，`app` 更像“应用服务层”。

#### interfaces 层

负责接外部世界。

它只做三件事：

1. 收请求
2. 协议转换
3. 返回响应

最怕的是在这一层偷写业务逻辑。

#### infrastructure 层

负责实现那些“系统总得和外部技术打交道”的部分：

- MySQL
- Redis
- OpenTelemetry
- 第三方 SDK

这层的代码通常最脏，但没关系。脏代码不怕，怕的是脏代码往里渗透。

## 3.1 如何做 interface 层

### interface 层的职责：协议适配，而不是业务承载

**interface 层最多只做协议翻译，不做核心规则。**

比如 HTTP， GraphQL 以后可能还要Grpc。他们本质用的核心接口是一致的。只是对外展示的方式不同。

在我这个项目里，`interface` 层我依然坚持用 **codegen** 的思想来做。

原因很简单：这一层虽然不复杂，但特别容易又长又重复。你手写 10 个 handler 还行，手写 100 个 query / mutation 的 resolver，很快就会变成机械劳动。

所以我的思路一直很统一：

- `domain` 手写，放核心规则
- `app` 手写，放用例编排
- `interface` 尽量 codegen，放协议适配

因为 `interface` 层天然就很像模板代码：

- 收协议参数
- 做基础参数转换
- 调 app service
- 把结果组装成协议响应
- 把内部错误映射成外部错误

这类代码如果长期靠人工堆，很容易出现两个问题：

1. 代码量爆炸，但信息密度很低
2. 不同人写法逐渐漂移，最后边界不一致

所以我更愿意把它理解成一种“协议侧 adapter codegen”。

也就是说，interface 层不是靠工程师一点点手搓出来的，而是尽量从 schema、模型定义、操作定义里生成出来，只把真正有差异的部分留给人工补。

这里用 codegen，一个很核心的目标不是偷懒，而是：

**尽量不要让你的实现代码和约定好的协议发生偏移。**

因为 interface 层一旦长期手写，最容易出现的问题不是“不会写”，而是“慢慢写歪了”。

比如：

- schema 已经变了，但 resolver 还按老字段处理
- 错误返回格式约定变了，但某些 handler 没同步
- 某个参数本来是必填，结果某一层偷偷放松了约束

所以 codegen 对 interface 层的价值，不只是省代码，更重要的是持续把实现往协议定义上拉齐。

你看，不管是 HTTP 还是 GraphQL，它们做的事情本质一样：

- 外部协议参数
- 转内部 input
- 调 app service
- 转外部协议响应

### interface 层也特别适合做 fuzz 测试

还有一个我很喜欢的点是：`interface` 层非常适合做 fuzz 测试。

因为这一层离用户输入最近，最先接触到各种“不干净”的数据：

- 空字段
- 超长字符串
- 非法 enum
- 畸形 JSON
- 边界时间格式
- 奇怪的分页参数

而 interface 层本身又主要在做：

- 解析
- 转换
- 校验
- 错误返回

这刚好就是 fuzz 最容易打出价值的地方。

说白了，fuzz 在这里不是为了验证业务规则对不对，而是为了验证：

- 你的协议解析会不会 panic
- 你的参数转换会不会越界
- 你的错误返回是不是稳定
- 你的边界输入会不会把 handler / resolver 打挂

所以在我的理解里，interface 层非常适合用 fuzz 去兜“输入鲁棒性”。

domain 层更适合高密度单测，repo 层更适合集成测试，而 interface 层特别适合拿 fuzz 去扫协议边界。

### interface 层最关键的价值：守住边界错误转换

这一层还有一个非常重要的职责：**把内部错误变成外部协议能理解的错误。**

比如：

- HTTP 需要状态码
- GraphQL 需要 `extensions.code`
- gRPC 需要 status code

这时候 interface 层就是最合适的边界。

例如 HTTP：

```go
func writeError(w http.ResponseWriter, err error) {
    bizErr := bizerrors.WrapError(err, bizerrors.SystemError, "unexpected error")

    writeJSON(w, bizErr.GetHTTPStatusCode(), bizerrors.ErrorResponse{
        Success: false,
        Code:    bizErr.Info().GetCode(),
        Message: bizErr.Msg(),
        TraceID: bizErr.RequestId(),
    })
}
```

GraphQL 也一样，把 `Code`、`Message`、`TraceID` 映射到 `extensions` 里即可。

这样好处非常大：

- 领域层不需要知道 HTTP 400/403/404
- repo 层不需要知道 GraphQL error shape
- 不同协议层都能复用同一套内部错误模型

## 3.2 如何做 repo 层

### repo 不是“帮你把 SQL 挪个地方”

**Repo层是持久化语义和领域语义之间的翻译。**

Repo层是比较薄的一层。但是并非是一个毫无逻辑的一层。

他负责的是多个表数据的拼接。
是负责将你所有数据库语义翻译成业务语义的地方。比如说0->low, 1->high 枚举的处理。
以及如果你将来发生了分库分表。让这些逻辑不要侵入到你的业务代码。

repo 层的价值就在于：上层不用看这些细节。

### 为什么是sqlC 
在AI时代，我比较坚持 **codegen** 的思想。

因为我希望：

- 先把 SQL 明明白白写出来
- 先直观看到数据库最终执行的语句长什么样
- 再基于这份 SQL 生成 Go 代码

这样做的核心目标也是一样的：

**不要让实现代码和你真正想执行的 SQL 发生偏移。**

如果你把 repo 完全交给 ORM，有时候你以为自己写的是“这个查询”，最后实际跑出去的是另一个形状的 SQL。

问题不一定出在 ORM 不好，而是 ORM 天生带着一套自己的抽象和默认行为，比如：

- 自动拼接关联
- 默认 where 条件
- 某些字段的零值语义
- order by / limit 的隐式处理
- 预加载、懒加载、扫描规则

这些“框架自有知识”一多，就很容易让你最后执行出来的 SQL 和你脑子里想的 SQL 不完全一致。

而我不希望 repo 层变成“猜 ORM 最后会发什么 SQL”。

我希望 repo 层是：

- SQL 先写清楚
- SQL 就是事实来源
- Go 代码只是这份 SQL 的类型安全外壳

所以 `sqlc` 对我来说，不只是一个代码生成工具，它更像是一种约束：
这样你在review代码，或者说review功能的时候，根据sql其实一眼就明白是否符合你的预期

**让 repo 层始终贴着最终 SQL 在实现，而不是贴着 ORM 的抽象在实现。**

### repo 层有两个常见误区

#### 误区 1：repo 直接返回数据库模型

比如直接返回某个 `mysqlRecordDO`。

这样上层马上就会被数据库结构污染。

更稳的做法是：repo 返回 domain 能理解的对象，数据库行结构只在 repo 内部消化。

#### 误区 2：repo 里开始写业务判断

repo 只关心“怎么查”“怎么存”“以及多表数据的组装”。

至于“这个用户查不到这个模型该怎么办，查到具体的数据要怎么处理”，那是更靠近 domain/app 的事情。

## 4. 如何搭建真正的可观测性

这一节其实我主要想讲三件事：

1. 出入口日志一定要打好
2. Go 请求链路的 recovery 一定要有
3. `go func()` 的日志不能漏，尤其 panic 之后最容易把日志打丢

- 入口日志负责判断“请求到底有没有进来”
- 出口日志负责判断“请求最后成功没有、耗时多少、action 是什么”
- recovery 负责保证请求 panic 时日志不要断
- 异步协程 wrapper 负责保证 `go func()` panic 时日志也不要断

只要这几层先做扎实了，大多数线上问题你都能先定位个八九不离十。

至于指标，很多时候不需要一开始就到处手工埋。

只要你的日志字段设计是对的，大多数指标直接从 ES 聚合出来就够用了，比如：

- QPS
- P95 / P99 延迟
- 错误率
- 各类错误码占比

所以这节表面上在讲“可观测性”，本质上其实是在讲：

**怎么把日志这一层先搭扎实。**

![可观测性的第一版要先守住三件事](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/04-framework-observability-guardrails.png)

### 1. 出入口日志怎么打

1. 请求标识字段 用于把一条请求从头串到尾： `req_id`
2. 业务语义字段 用于回答“系统正在干什么” `action`：RESTful 的 action 通常就是 path，GraphQL 则要额外解析一下
3. 耗时字段 用于回答接口耗时
4. 出入口的request， response必须要打。 很多时候，在和别人联调时。这个可以快速判断到底是你的错误还是上游的错误。

#### Action
这里我自己会特别强调 `action`。
因为对于大多数指标来说，ES 聚合就够了；但前提是你的日志里必须有一个足够稳定、足够明确的业务标识字段。
而在 GraphQL 场景里，这个字段如果设计不好，排障会很痛苦。
HTTP 接口天然有 path；但 GraphQL 往往所有请求都打到同一个 endpoint。  
这时候如果日志里没有额外的业务标识，你看到的就只是：一个endpoint， 没法从大盘上看出哪些请求多，哪些请求低

所以我这里做了一个很实用的小约束：

1. 请求 Header 里必须显式传入 `action`
2. 网关先用 `action` 做第一层粗粒度鉴权判断
3. 然后再解析 body，检查 query / mutation 的 name 和 `action` 是否一致

这样做有两个直接收益：

1. 鉴权链路前置了，很多非法请求在网关层就能拦住
2. `action` 会非常自然地被带进整条请求链路，最后进入所有日志字段

这样我的入口日志、出口日志，以及中间关键事件日志里，都会稳定带上 `action`。

它的价值非常大，因为它几乎可以作为 GraphQL 语义下一个“唯一接口标识”来用。

比如你想回答这些问题时：

- `CreateModel` 最近是不是慢了
- `FindManyModels` 的错误率是不是突然升高
- 某个租户是不是只有某个 action 会失败

只要日志里有 `action`，这些问题都能很快在 ES 里聚合出来。

所以日志字段设计里，一个很关键的点就是：

**一定要明确标记入口日志和出口日志，并且把 `action` 贯穿进去。**


### 2. recovery 为什么是必须项

但在讲协程之前，还要先说一个更基础的点：

**HTTP 入口的 recovery middleware 是必须的。**

这个其实已经算很多 Go HTTP 框架里的最佳实践了。

原因很简单：如果请求在 handler 链路里 panic，而你没有 recovery middleware，那这次请求最关键的上下文就会直接断掉。

所以第一层兜底，应该放在 HTTP 入口。

像这样的 recovery middleware，我会认为是第一版工程的必选项：

```go
func ChiRecoveryMiddleware(logger logfacade.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            defer func() {
                if rec := recover(); rec != nil {
                    requestID := resolveRequestID(r)

                    logger.With(
                        logfacade.Any("panic", rec),
                        logfacade.String("stack", string(debug.Stack())),
                        logfacade.Duration("duration", time.Since(start)),
                        logfacade.String("request_id", requestID),
                    ).Errorf(r.Context(), nil, "request_panic")

                    w.WriteHeader(http.StatusInternalServerError)
                    _ = json.NewEncoder(w).Encode(map[string]string{
                        "error":      "Internal Server Error",
                        "request_id": requestID,
                    })
                }
            }()

            next.ServeHTTP(w, r)
        })
    }
}
```

虽然说AI时代， 很少能写出空指针错误了。但是一旦panic，你要的是快速通过日志定位错误。只要一个request_id 就能回到事故现场。

### 3. `go func()` 为什么必须统一封装

这一点还是当初和B站的毛剑老师学习的。在我后续接触到的项目中，目前无人做到这一点。

很多人平时为了省事，直接写：

```go
go doSomething(ctx)
```

问题在于这会把异步执行变成一个“黑洞”：

1. 出错了未必能和原请求关联起来
2. panic 之后只剩标准输出或进程级异常
3. trace 和日志上下文很容易断
4. 你甚至不知道到底是哪一个异步任务炸了

所以真正的工程实践不是“记得打日志”，而是**把协程入口收口**。

不要依赖调用方自觉每次都写一遍 `defer recover`。  这种东西一旦靠自觉，最后一定有人忘。 还是那句话，依赖约束而不是规范。

其实这里的 `go func()`，我会直接分成三类场景：

#### 1. fire-and-return

也就是主请求把一个异步动作扔出去，自己不等结果，典型场景像：

- 异步记审计日志
- 异步发通知
- 异步刷新一点非关键缓存

这种场景最适合用 `GoWithCtx`。

例如：

一个比较顺手的实现可以是：

```go
func GoWithCtx(ctx context.Context, fn func(context.Context)) {
    go func() {
        recovered := panics.Try(func() {
            fn(ctx)
        })

        if recovered != nil {
            logger := logfacade.GetLogger(ctx)

            logger.With(
                logfacade.Any("panic_value", recovered.Value),
                logfacade.String(logfacade.StackFieldKey, string(recovered.Stack)),
                logfacade.Int(logfacade.GoroutineCountKey, runtime.NumGoroutine()),
                logfacade.String(logfacade.PanicTimeKey, time.Now().Format(time.RFC3339Nano)),
            ).Errorf(ctx, nil, "协程发生 panic")
        }
    }()
}
```

这种写法很适合 fire-and-return。

因为调用方不需要等待结果，但最关键的是：  
一旦协程内部 panic 了，它不会直接变成一段脱离上下文的孤立栈，而是会被 `GoWithCtx` 兜住，并带着请求上下文打回日志。

#### 2. 并发执行，但最后要收束结果

比如：

- 并行查多个下游
- 并行跑多个校验步骤
- 并行执行多个任务，然后统一返回 error

这种场景就更适合 `conc` 这类工具。

因为你要解决的不是“起协程”本身，而是：

1. 并发度控制
2. panic 恢复
3. error 汇总
4. 等全部任务结束后统一收口

一个比较顺手的写法，可以是用 `ObservedTask` 包一层，再交给 `conc` 的任务池统一收束：

```go
func ObservedTask(name string, fn func() error) func() error {
    return func() (err error) {
        recovered := panics.Try(func() {
            err = fn()
        })

        if recovered != nil {
            log.Printf("panic in task: name=%s value=%v stack=%s", name, recovered.Value, recovered.Stack)

            // metrics
            // taskPanicCounter.WithLabelValues(name).Inc()

            // trace
            // span.RecordError(recovered.AsError())

            return fmt.Errorf("task %s panic: %w", name, recovered.AsError())
        }

        return err
    }
}

p := pool.New().
    WithMaxGoroutines(10).
    WithErrors()

p.Go(ObservedTask("sync-user", func() error {
    return syncUser()
}))

p.Go(ObservedTask("sync-order", func() error {
    return syncOrder()
}))

if err := p.Wait(); err != nil {
    return err
}
```

这套写法的关键价值在于：

1. 任务有名字，日志不再是匿名 panic
2. panic 被转成 error，可以回到正常错误链路
3. 同一个封装里可以同时挂日志、metrics、trace
4. 并发数量和回收时机有统一约束，不容易失控

很多时候真正麻烦的不是“panic 发生了”，而是：

- 它发生在哪个任务
- 这个任务是不是批量任务里某一个分支炸了
- 除了 panic 之外，还有没有普通 error 混在一起
- 最终调用方能不能用统一方式感知失败

`ObservedTask + pool.Wait()` 这种模式，本质上就是把这些问题一起收口了。

#### 3. worker pool

如果你的场景不是一次性并发，而是长期消费任务，比如：

- 后台任务队列
- 批量同步
- 固定规模的异步处理池

那更适合 `pond` 这种 worker pool 方案。

因为它更擅长的是：

1. 固定 worker 数量
2. 控制队列堆积
3. 长时间稳定跑任务
4. 在池级别统一挂日志、metrics、panic wrapper

比如这种后台任务消费场景，就很适合：

```go
pool := pond.NewPool(20)
defer pool.StopAndWait()

submitObservedTask := func(taskName string, fn func() error) {
    pool.Submit(func() {
        if err := ObservedTask(taskName, fn)(); err != nil {
            log.Printf("task failed: name=%s err=%v", taskName, err)
        }
    })
}

submitObservedTask("sync-user", func() error {
    return syncUser()
})

submitObservedTask("sync-order", func() error {
    return syncOrder()
})
```

这里关键也不是 `pond` 这个库本身，而是：

- 提交任务的入口是统一的
- 每个任务都会自动走日志和 panic wrapper
- worker pool 的并发规模和回收方式是可控的
- 有意识的控制你的goroutine数量。不要因为一些业务价值不重要的goroutine并发高影响业务价值高的goroutine。

### 日志要按“事件”打，不要按“函数”打

很多人打日志，是进入一个函数打一条，退出一个函数打一条。

这样做的问题是：

1. 数量很多
2. 噪音很大
3. 真正重要的信息反而被淹没

更好的做法是围绕关键事件打日志。

比如
1. `request.started`
2. `auth.checked`
3. `schema.built`
4. `rls.applied`
5. `repo.query.started`
6. `repo.query.succeeded` 或 `repo.query.failed`
7. `request.completed`

这样你回放一次请求时，看到的是“故事线”，而不是“函数栈噪音”。

### 可观测性的本质是“预埋提问能力”

这是我自己工作里非常深的一个体会。

线上问题出现时，你并不是在“查看系统”，你是在“向系统提问”。

比如你在问：

- 哪个错误码最近激增
- 哪个租户经常打到限制
- 哪个action在拖慢整条链路

如果工程里没有提前把这些字段、指标、span 埋好，那么系统根本回答不了你。

所以所谓可观测性，本质上不是装 SDK，不是接平台，而是：

**在工程设计阶段，就提前想清楚未来你会问系统什么问题。**

## 这节课的总结

就是你在写代码的时候，就要预先想好发生错误怎么排查。不能直接一把梭哈写完，没有任何日志。那么我理解相当于你在高速开车，却没有系安全带。

**约束大于规范，所有依赖人的设计，都不是一个稳定的设计**
你不指望人去执行规范，那么对于AI来说，他也会同样犯这个问题。

总结成 4 句话：

1. 日志不是打印文本，而是统一上下文和字段语言
2. 错误不是一句字符串，而是开发者协议的一部分
3. DDD 分层不是为了优雅，而是为了隔离变化、保护核心规则
4. 可观测性不是装组件，而是让系统具备回答问题的能力

> Ps : 感觉让AI写这种总结的话写特别好，像相声里的468句。

如果你对这类数据模型、架构设计、Agentic Engineering 的内容感兴趣，欢迎关注我的公众号：**Luke's AI Hub**。

![公众号二维码](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/%E5%85%AC%E8%80%83/%E5%85%AC%E4%BC%97%E5%8F%B7.jpg)
