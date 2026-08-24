# 断路器设计笔记：从 Prometheus 误区到本地熔断器实现

![关闭时请求经开关走数据库；窗口错误率过高则开启开关，请求走降级、不打数据库](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/circuit-breaker-01-scene-switch-degrade.png)

最初的问题很朴素：能不能用 Prometheus 给数据库做熔断？想清楚之后发现，这个问题背后牵出了一整套断路器（Circuit Breaker）的设计——本地状态怎么存、滑动窗口怎么实现、并发安全怎么保证、Half-Open 怎么设计。这套设计不是数据库专属的，微服务调用、第三方 API、缓存层遇到的问题是同一类，文章里全程拿数据库当例子，只是因为它是最先触发我思考的场景。记录下来，也算是把这条链路自己走一遍。

## 1. 什么场景需要熔断

判断标准很简单：**调用的是一个资源有限、延迟不稳定、可能级联拖垮整个系统的下游依赖**。

- 数据库/连接池变慢（慢查询、锁等待）时，如果不熔断，大量请求会占满连接池、线程池，把"下游慢"传染成"自己也挂了"。
- 微服务间的 RPC/HTTP 调用——这也是 Netflix Hystrix 最初要解决的场景：级联故障。
- 第三方 API（支付网关、短信服务），失败代价高，还可能按调用计费。
- 缓存层（Redis）挂了时，避免所有请求穿透打 DB。

反过来，调用轻量、失败代价低、不占用共享资源的操作（比如异步打点日志），熔断就是过度设计。自查问题：**如果这个依赖突然变慢变不稳定，我的服务会不会因为大量请求卡在等它而被拖垮？**

## 2. 误区：直接用 Prometheus 做熔断决策

最初的想法是省事："每次调用 DB 前，先查一下 Prometheus 里最近的失败率，超过阈值就不打库。" 这个方案有几个硬伤：

1. **延迟不是"变高"，是被放大了几个数量级。** Prometheus 查询本身几十毫秒起步，而一次 DB 调用可能才 5ms——相当于给所有健康调用也强行加上了 10~20 倍的延迟。
2. **Prometheus 是 pull 模型，scrape 间隔通常 15~30s**，这个延迟对单次请求级别的熔断来说太慢，数据永远是"过去"的。
3. **新增了一个依赖，也新增了一种故障模式**：Prometheus 查询本身失败/超时怎么办？要不要 fail-open 还是 fail-closed？这是原方案里不存在的决策点。
4. **多 Pod 场景下，聚合视角和真实故障域不匹配**：如果查的是全局失败率，某个 Pod 自己跟 DB 的连接明明是好的，可能因为别的 Pod 挂了拉高全局指标而被误伤；反过来，某个 Pod 自己网络分区了，但全局大盘看起来健康，它还是会一直傻乎乎地重试失败。熔断的粒度和真实故障域没对齐。

**结论**：熔断决策必须是本地的、毫秒级的；Prometheus 更适合做观测和"二级熔断"——比如多个实例同时异常时，通过 Alertmanager 触发一个全局开关做跨实例的统一降级，弥补本地熔断器各自为战、互不通气的短板。但这是叠加在本地熔断器之上的兜底，不是替代。

## 3. 本地熔断器：按资源分开的单例

熔断器的状态（当前是不是在熔断、最近的失败率）要存在本地内存里，而且是**按资源分开的单例**，不是整个进程一个全局状态：

```typescript
const registry = new Map<string, CircuitBreaker>()

function getBreaker(resourceKey: string): CircuitBreaker {
  if (!registry.has(resourceKey)) registry.set(resourceKey, new CircuitBreaker())
  return registry.get(resourceKey)!
}
```

`db:orders`、`db:inventory` 分开算,因为不同资源可能一个健康一个不健康,混在一起统计会互相污染判断。

这里还有个问题:**这个状态要不要在多个实例(Pod)之间共享?** 答案一般是不需要。原因:

- 速度——任何跨进程的状态同步(Redis、etcd)都会给"快速失败"这条路径本身加一个可能失败的依赖,本末倒置。
- 不需要强一致也能收敛——如果 DB 真的挂了,每个实例的本地窗口都会独立看到失败率飙升,基本在同一个时间尺度内各自触发熔断,不需要互相通知也能达到"全局都熔断了"的效果。

只有实例数很少、想避免"各自试探恢复"导致后端被同时打爆时,才会考虑用 Redis 存一个共享的探测令牌——这是例外,不是常态。

## 4. 滑动窗口:怎么统计"最近一段时间"的失败率

最直觉的想法是用队列——记录每次调用的 `(timestamp, success/failure)`,统计时把过期的从队头弹出。这个思路对,但生产环境几乎不用,因为高 QPS 下队列会变得很长(每秒 5000 次调用、10 秒窗口就是 5 万条),每次统计都要遍历清理,开销随 QPS 线性增长。

实际做法是**固定数量的时间桶,用环形数组实现**,只存计数,不存明细:

```typescript
class SlidingWindow {
  bucketDurationMs = 1000       // 每个桶代表 1 秒
  numBuckets = 10               // 10 个桶 = 10 秒窗口

  buckets = Array.from({ length: this.numBuckets }, () => ({
    success: 0,
    failure: 0,
    bucketTimeSlot: -1,   // 这个桶当前记录的是第几个"秒片"
  }))

  record(success: boolean) {
    const now = Date.now()
    const timeSlot = Math.floor(now / this.bucketDurationMs)
    const idx = timeSlot % this.numBuckets
    const bucket = this.buckets[idx]

    // 数组下标每 numBuckets 秒就会重复利用(取模的必然结果)
    // bucketTimeSlot 用来区分"这次要写的是不是同一秒",决定该累加还是该先清零重开
    if (bucket.bucketTimeSlot !== timeSlot) {
      bucket.success = 0
      bucket.failure = 0
      bucket.bucketTimeSlot = timeSlot
    }
    success ? bucket.success++ : bucket.failure++
  }

  aggregate() {
    const currentSlot = Math.floor(Date.now() / this.bucketDurationMs)
    let success = 0, failure = 0
    for (const bucket of this.buckets) {
      // 跳过已经滑出窗口的旧桶,不能拿陈旧值参与统计
      if (currentSlot - bucket.bucketTimeSlot < this.numBuckets) {
        success += bucket.success
        failure += bucket.failure
      }
    }
    const total = success + failure
    return { total, failureRate: total === 0 ? 0 : failure / total }
  }
}
```

`timeSlot = Math.floor(now / 1000)` 是一个从 1970 年开始一直往上涨、永不重置的数字,而数组下标 `idx = timeSlot % numBuckets` 每过 10 秒就会转一圈回到同一个格子——`bucketTimeSlot` 就是用来识别"这个格子现在的内容是不是已经过期,复用前要不要先清零"。少了这一步,滑动窗口就变成了从进程启动就开始的全量累计,失去了"只看最近 N 秒"的意义。

这个设计还有个好处:**服务闲置很久(比如凌晨 30 分钟没流量)也不会出问题**。因为所有桶的 `bucketTimeSlot` 都远远落后于当前时间,`aggregate()` 会把它们全部当成过期数据跳过,算出 `total = 0`,不会误判成任何异常状态。第一个到来的新请求会命中一个"待清零"的桶,自动开始一个全新的窗口——不需要额外写"检测闲置并重置"的逻辑,清零逻辑本身就把这个 case 覆盖了。

这就是 Hystrix 的 `HystrixRollingNumber`、resilience4j 内部用的思路,常被称为 rolling window counter 或 bucketed counter。

## 5. 并发安全:check-then-act 必须是原子的

上面的 `record()` 在 Node.js 单线程环境下没问题——同步函数执行不会被打断。但如果放到 Go/Java 这种真正多线程的环境(生产级熔断器库大多是这类语言写的),`if (bucket.bucketTimeSlot !== timeSlot) { 清零 }` 这段就是经典的 **check-then-act 竞态**:

```
线程 A: 读 bucketTimeSlot(旧值) → 判断不等 → 准备清零
线程 B: 读 bucketTimeSlot(旧值) → 判断不等 → 准备清零
线程 A: 清零,写入新值,success++     → bucket = {success: 1}
线程 B: 清零(把 A 刚写的 1 冲掉!),写入新值,success++ → bucket = {success: 1}
```

这一秒明明发生了 2 次成功调用,统计结果却只有 1——丢计数。解法是把整个 check-then-act 包进一把锁(临界区极小,几个整数操作,锁开销可以忽略):

```typescript
record(success: boolean) {
  this.mutex.lock()
  try {
    // ...同样的逻辑
  } finally {
    this.mutex.unlock()
  }
}
```

生产库(Hystrix 的 `HystrixRollingNumber`)会用 CAS(compare-and-swap)代替锁来获得更高吞吐:线程发现 `timeSlot` 变了,就尝试原子地把新桶换上去,只有一个线程能成功,其他线程直接用换好的新桶,内部计数用 `AtomicLong`/`LongAdder` 保证自增原子。这是同一个问题的两种解法,锁更简单,CAS 性能更好、实现更复杂。

**这个"check-then-act 必须整体原子"的教训会反复出现**——不只是桶清零,后面 Half-Open 的实现里也是同一个坑的变体。

## 6. Half-Open:为什么需要,怎么实现

如果只有 Closed/Open 两个状态,冷却时间一到,只能选择"一次性放开所有流量"或者"继续硬等"。前者的问题是:假设 DB 刚开始恢复、还没完全回血,冷却结束的瞬间所有被拦下的请求会同时涌向它——这就是惊群效应,可能立刻把刚恢复的 DB 再打垂,陷入"熔断→冷却→瞬间全量→打垂→再熔断"的死循环。

Half-Open 的作用是**用极小的代价先试探一下,而不是直接下重注**:冷却结束后只放 1 个(或极少量)探测请求,其余照样拒绝——探测成功就转回 Closed 正常放量,失败就退回 Open 重新冷却,只损失一次探测的代价,不会对下游造成二次冲击。

实现上要处理三件事:状态转换要跟"抢探测名额"绑在一起做成一个原子操作;探测请求本身要有超时保护,否则调用方一旦忘了回调,熔断器会永远卡在"探测中"出不来;其余分支照常拒绝。

```typescript
canPass(): boolean {
  this.mutex.lock()
  try {
    if (this.state === State.CLOSED) return true

    if (this.state === State.OPEN) {
      if (now() - this.openedAt! < this.openDurationMs) return false

      // 转换和抢探测名额必须在同一把锁里完成,否则多个线程会同时
      // 以为自己是第一个转换者,都把自己当探测放出去
      this.state = State.HALF_OPEN
      this.halfOpenProbeInFlight = true
      this.halfOpenProbeStartedAt = now()
      return true
    }

    // HALF_OPEN
    if (!this.halfOpenProbeInFlight) {
      this.halfOpenProbeInFlight = true
      this.halfOpenProbeStartedAt = now()
      return true
    }

    // 安全阀:探测卡死太久没人回调,重新放一个,避免永久卡住
    if (now() - this.halfOpenProbeStartedAt! >= this.halfOpenProbeTimeoutMs) {
      this.halfOpenProbeInFlight = true
      this.halfOpenProbeStartedAt = now()
      return true
    }

    return false
  } finally {
    this.mutex.unlock()
  }
}
```

一个容易踩的坑:如果把"状态转换"和"抢探测名额"拆成两次分开加锁的操作,中间会出现空隙——线程 A 做完转换、还没来得及抢名额,线程 B 就趁着这个空隙也抢到了名额,两个线程同时认为自己是探测者,一起打到了 DB 上。跟第 5 节的桶竞态是同一类 bug:即使每一步单独看是原子的,拆开之后组合起来就不再安全。

探测失败后是直接退回 Open 还是"多给几次机会"是个开放的权衡:直接退回更保守,适合探测代价高、非幂等的调用(避免多花钱去打注定失败的请求);多给几次机会更能容忍"探测本身运气不好"的随机抖动,适合下游本身网络环境就不太稳定、探测代价又低的场景。

## 7. 冷却时间:固定值还是指数退避

`openDurationMs`(熔断后多久重新试探)完全是自己配的,没有标准值:太短容易在"熔断-探测失败-再熔断"之间反复震荡(flapping);太长会让业务在依赖已经恢复之后还多扛一段时间的降级。

更成熟的做法是指数退避——探测失败就翻倍冷却时间,探测成功就重置回最小值:

```typescript
onProbeFailed() {
  this.consecutiveProbeFailures++
  this.currentOpenDurationMs = Math.min(
    this.baseOpenDurationMs * (2 ** this.consecutiveProbeFailures),
    this.maxOpenDurationMs
  )
  this.state = State.OPEN
  this.openedAt = now()
}

onProbeSucceeded() {
  this.consecutiveProbeFailures = 0
  this.currentOpenDurationMs = this.baseOpenDurationMs
  this.state = State.CLOSED
}
```

好处是短暂抖动能很快恢复,而真正的长时间故障会自动拉长探测间隔,避免每几秒就发一次无意义的探测去骚扰一个明知还没修好的依赖。

## 8. 落地:resilience4j 和 gobreaker 怎么用

前面全是手写的伪代码,实际项目里没必要自己造轮子——resilience4j(Java)和 gobreaker(Go)基本就是把上面这套状态机、滑动窗口、half-open 逻辑打包好了。把配置项对应回我们讨论的概念,理解起来会很快。

### resilience4j(Java)

```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)                              // 对应 failureRateThreshold
    .slidingWindowType(SlidingWindowType.TIME_BASED)        // TIME_BASED 就是我们讲的按秒分桶;
                                                             // 还有 COUNT_BASED,按"最近 N 次调用"分桶
    .slidingWindowSize(10)                                  // 对应 numBuckets
    .minimumNumberOfCalls(20)                               // 对应 minRequestsInWindow
    .waitDurationInOpenState(Duration.ofSeconds(5))         // 对应 openDurationMs
    .permittedNumberOfCallsInHalfOpenState(3)               // half-open 放几个探测,不是只放 1 个
    .build();

CircuitBreakerRegistry registry = CircuitBreakerRegistry.of(config);
CircuitBreaker breaker = registry.circuitBreaker("db:orders");  // 对应 getBreaker(resourceKey)

// 函数式包装,内部自动完成 canPass() + 调用 + onResult()
Supplier<List<Order>> decorated = CircuitBreaker.decorateSupplier(breaker, () -> ordersDao.query(sql));
List<Order> result = decorated.get();

// 状态变化监听,对应我们手写的"暴露给 Prometheus 的 metrics"
breaker.getEventPublisher().onStateTransition(event ->
    log.info("{}: {} -> {}", event.getCircuitBreakerName(),
        event.getStateTransition().getFromState(), event.getStateTransition().getToState()));
```

`slidingWindowType` 这两种取值的行为差异比注释里那一句更值得展开。核心的不对称点在于:**旧数据是"被新数据挤出"还是"靠时钟自己过期"。**

- `COUNT_BASED`:窗口 = 最近 N 次调用,跟时间无关。实现是一个固定大小的环形数组,每个格子存**一次调用**的结果,新调用来了就覆盖最老的格子。旧数据只有在"有新调用发生"时才会被挤出——如果调用突然变稀疏(比如凌晨没流量),窗口里的数据会一直停留在"上次还有调用时"的状态,不会自己更新。
- `TIME_BASED`:窗口 = 最近 N 秒,跟调用次数无关,就是第 4 节手写的按秒分桶那套。旧数据靠时钟自动过期,不需要任何新调用触发,对应第 4 节"闲置 30 分钟"场景里 `aggregate()` 自动跳过陈旧桶的那段逻辑。

这个不对称导致两者在 QPS 波动大的场景下表现相反:低 QPS 时,`COUNT_BASED` 的窗口时间跨度会跟着 QPS 反比伸缩("最近 10 次"可能横跨几个小时,掺杂早已过期的判断依据),而 `TIME_BASED` 则容易一直卡在 `minimumNumberOfCalls` 攒不够样本的问题上(下面会讲);高 QPS 时,`COUNT_BASED` 新鲜度更高但样本量对于统计意义来说可能太小,`TIME_BASED` 统计更稳但可能稀释掉短时间的剧烈抖动。resilience4j 默认是 `COUNT_BASED`、`slidingWindowSize` 默认 100。没有绝对的优劣,调用频率稳定可预测的场景(内部微服务间调用)`COUNT_BASED` 更省心;调用频率波动大或者极度稀疏(比如低频的第三方 API)则要在两者的副作用之间做权衡——如果稀疏到 `TIME_BASED` 经常凑不够 `minimumNumberOfCalls`,`COUNT_BASED` 反而更实用,至少能保证攒够 N 次就有一个有统计意义的失败率。

`minimumNumberOfCalls` 这个参数值得单独强调一下,因为它对应的正是第 2 节讨论过的"低 QPS 下单个样本决定生死"的问题:窗口内调用数没达到这个值,resilience4j 不会计算失败率、更不会跳转到 Open,不管这几次调用是不是全失败。如果这个值设得比实际调用频率还高(比如低频调用的下游,10 秒窗口里可能就打 1、2 次),熔断器会一直算不出"够格"的失败率,永远不会触发——等于熔断形同虚设。另外要注意 resilience4j 的一个具体限制:`slidingWindowType` 是 `COUNT_BASED` 时,`minimumNumberOfCalls` 不能超过 `slidingWindowSize`(否则窗口永远攒不满这么多样本),这是配置时容易踩的一个坑。

指数退避不是默认行为(默认 `waitDurationInOpenState` 是固定值),要显式配置 `IntervalFunction`:

```java
.waitIntervalFunctionInOpenState(
    IntervalFunction.ofExponentialBackoff(Duration.ofSeconds(5), 2.0, Duration.ofSeconds(60)))
```

这行代码就是第 7 节里手写的 `onProbeFailed()`/`onProbeSucceeded()` 那套逻辑,base=5s、倍数=2、上限=60s,完全对得上。

Prometheus 集成也是内置的,不用自己手动 `exportMetrics()`:

```java
TaggedCircuitBreakerMetrics.ofCircuitBreakerRegistry(registry).bindTo(prometheusMeterRegistry);
```

会自动产出 `resilience4j_circuitbreaker_state`、`resilience4j_circuitbreaker_calls` 之类的指标,就是第 2 节说的"本地决策、指标暴露给 Prometheus 做观测"这套分层。

### gobreaker(Go, sony/gobreaker)

```go
var breakers sync.Map   // 对应 registry: Map<string, CircuitBreaker>

func getBreaker(resourceKey string) *gobreaker.CircuitBreaker {
    if b, ok := breakers.Load(resourceKey); ok {
        return b.(*gobreaker.CircuitBreaker)
    }
    b := gobreaker.NewCircuitBreaker(gobreaker.Settings{
        Name:        resourceKey,
        MaxRequests: 3,                // half-open 放几个探测,0 的话默认只放 1 个,跟我们最初的实现一致
        Interval:    10 * time.Second, // closed 状态下多久整体清零一次计数
        Timeout:     5 * time.Second,  // 对应 openDurationMs
        ReadyToTrip: func(counts gobreaker.Counts) bool {
            // 对应我们手写的 failureRateThreshold + minRequestsInWindow 判断
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 20 && failureRatio >= 0.5
        },
        OnStateChange: func(name string, from, to gobreaker.State) {
            circuitStateGauge.WithLabelValues(name).Set(stateToFloat(to))  // 手动暴露给 Prometheus
        },
    })
    breakers.Store(resourceKey, b)
    return b
}

func QueryOrdersDB(sql string) ([]Order, error) {
    breaker := getBreaker("db:orders")
    result, err := breaker.Execute(func() (interface{}, error) {
        return ordersDao.Query(sql)   // Execute 内部完成 canPass() + 调用 + onResult()
    })
    if err == gobreaker.ErrOpenState {
        dbCallsTotal.WithLabelValues("orders", "short_circuited").Inc()
    }
    return result.([]Order), err
}
```

有个值得注意的差异:**gobreaker 的 `Interval` 是"整体清零",不是我们第 4 节手写的分桶滑动窗口**——到点了直接把 Counts 全部归零重新开始,而不是像环形数组那样平滑滑动。这意味着 gobreaker 的统计粒度比我们手写的版本更粗一些,窗口边界处会有一次"突然清零"而不是渐进式滑出。如果确实需要平滑的分桶滑动窗口,Go 里可以用 `mercari/go-circuitbreaker`,或者索性照第 4 节的思路自己写(其实也没几行代码)。gobreaker 也没有内置的 Prometheus 集成,要像上面 `OnStateChange` 里那样自己手动接一下,不像 resilience4j 那样有现成的 Micrometer binding。

两个库的共同点:都提供一个"一站式"的 `Execute`/`decorateSupplier` 把 `canPass()` + 调用 + `onResult()` 合并成一次函数调用,也都各自提供更底层的手动模式(resilience4j 的 `tryAcquirePermission()`/`onSuccess()`/`onError()`,gobreaker 的 `TwoStepCircuitBreaker`),对应我们从头拆开写的 `canPass()`/`onResult()`,在不方便用闭包包裹调用的场景(比如调用分散在多个地方)会更好用。

## 9. 回顾一下学到的要点

- 熔断决策必须是本地、毫秒级的;Prometheus 适合做观测和"二级熔断"兜底,不能替代本地决策——两者的时间尺度差了几个数量级。
- 熔断器状态是按资源分开的本地单例,一般不需要跨实例共享,因为各实例独立收敛的结果跟"全局同步"差别不大,却省掉了一个新的分布式依赖。
- 滑动窗口用固定数量的时间桶+环形数组实现,内存和计算量跟 QPS 无关;复用格子前必须验证时间戳,不能相信陈旧值——这条规则同时解决了"数据正确性"和"长时间闲置后的边界情况"两个问题。
- 任何 check-then-act 逻辑(桶清零、Half-Open 状态转换)在多线程环境下都必须作为一个原子单元处理,拆开成两步会重新引入竞态,哪怕拆开的每一步单独看都是"线程安全"的。
- Half-Open 存在的意义是用最小代价验证一个假设(下游是否恢复),而不是在冷却结束后直接全量下注,避免二次冲击刚恢复的依赖。
- 冷却时间、失败率阈值、最少样本数这些参数没有统一答案,要结合调用频率(QPS)和单次调用的代价(是否昂贵、是否幂等)来定——这也是判断"直接退回 Open 还是多给几次机会"这类设计取舍的通用准则。
