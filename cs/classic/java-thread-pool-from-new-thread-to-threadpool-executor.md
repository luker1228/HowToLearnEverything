# 一次旁路任务拖垮核心业务：Java 线程池故障复盘与治理

![共享线程池被旁路慢任务占满，核心请求被拖垮](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/01-comparison-bulkhead-isolation.png)

由一次故障引起的复盘到最后重新对线程池的认识。

首先声明，这不是最近的故障，大概是几年前的故障。最近一直在思考，在尝试各种思路突破自己。我工作的这5年，对我来说到底成长了什么呢？所以想复盘一下之前的一些故障。其实是可以给我带来思考的，
只不过我自己以前不太重视这些。 

背景是这样的。项目里有一个**刷租户资源**的异步任务：逻辑很重，跑一遍要 3–5 分钟；它是个**可重入**的逻辑，同一个租户被重复触发也不会出错，顶多多跑几遍。上游监听 Kafka，收到消息就发起这个任务。

当时前端出了一个 bug：对**同一个租户**疯狂地、反复地触发 Kafka，大概会把流量放大几十倍。于是大量重复的开通任务被丢进了线程池。

任务本身又慢（3–5 min）、又不断涌进来，很快就把线程池占满了。而它和我们的主业务逻辑共用着同一个**业务线程池**——最后线程池满了，正常请求也拿不到线程，整个业务就访问不了了。

一个分支路径，最终影响了主路径，虽然是我很久之前写好的代码。当时虽然轻轻放下了，但其实是一个很严重的故障。
---

站在今天的角度和理解去复盘。我犯了以下错误。

1. 旁路逻辑一定是受控的。旁路逻辑影响主链路是非常可怕的。当时主要是我没有给这个旁路路基配置单独的线程池。事后也复盘了这一点。
2. 虽然我们配置了socket的监控数告警，但是当时已经晚了。线程池已经堆积了大量满任务。都是旁路逻辑。缺少对线程池本身的告警。
3. 我这里处理任务要加状态，对于同一个租户，如果已经执行过的任务，就不让他执行。

说白了，就是系统的健壮性比较差，所以才会因为前段的一点小bug，就导致后端服务崩溃。最后解决的手段也很有限，需要发版去解决。缺乏快速响应的手段。后端服务只能等着前段修复（这里后端发版也可以解决，但是发版本比较慢）。如果站在组长或者更高级别的角度看这个问题，其实是非常差的架构设计。

由此引发了我的第一点，对Java线程池的了解。我之前对Java线程池的了解太少了。

# 一、全景：一个任务提交后，到底走哪条路

首先我们来看一个线程的流程图。

![ThreadPoolExecutor.execute 决策流程：核心线程 → 队列 → 非核心线程 → 拒绝策略](https://luke-1307356219.cos.ap-chongqing.myqcloud.com/articles/01-flowchart-threadpool-execute.png)

这里有个反直觉、但后面会反复踩的点：**不是"核心线程满了就直接开新线程"，而是先往队列里塞，队列塞满了才扩容**。这个是我之前一直理解错误的地方。

# 二、ShowMeCode: 来看看源码

直接来看看源码

```java
public class ThreadPoolExecutor extends AbstractExecutorService {

    // 一个 int 同时表示"池的状态"和"当前线程数"，下一节细讲
    private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));

    // —— 线程数的边界 ——
    private volatile int corePoolSize;      // 平时常驻几个线程
    private volatile int maximumPoolSize;   // 最多能开到几个

    // —— 任务排队的队列 ——
    private final BlockingQueue<Runnable> workQueue;

    // —— 空闲线程多久回收 ——
    private volatile long keepAliveTime;
    private volatile boolean allowCoreThreadTimeOut;

    // —— 造线程 / 满了怎么办 ——
    private volatile ThreadFactory threadFactory;
    private volatile RejectedExecutionHandler handler;

    // —— 真正在干活的线程，都装在这个集合里 ——
    private final HashSet<Worker> workers = new HashSet<Worker>();
}
```

这些字段的作用是啥。这些其实我都比较熟悉，比较重点关注的是他们的实现方式。

```text
workers          真正在跑的线程都在这（注意：装的是 Worker，不是 Thread）
workQueue        任务还没被线程领走时，先在这里排队
ctl              池现在什么状态 + 现在有几个线程，全塞在一个 int 里
corePoolSize     平时至少留几个线程
maximumPoolSize  忙的时候最多能开几个
keepAliveTime    超过 core 的线程，空闲多久就回收
threadFactory    每次开线程由它 new（顺便起名字）
handler          线程开满、队列也满了，新任务交给谁处理（拒绝策略）
```

# 三、`ctl` 为什么只用一个 int 实现？

**一句话答：因为"改状态"和"改线程数"经常要同时发生，塞进一个 int，一次 CAS 就能原子地一起改，不用加锁。**

```java
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));

private static final int COUNT_BITS = Integer.SIZE - 3;        // 29
private static final int CAPACITY   = (1 << COUNT_BITS) - 1;   // 低 29 位能装的最大线程数 ≈ 5 亿

// 高 3 位 = 状态（能表示 8 种，池只用了 5 种）
private static final int RUNNING    = -1 << COUNT_BITS;   // 111
private static final int SHUTDOWN   =  0 << COUNT_BITS;   // 000
private static final int STOP       =  1 << COUNT_BITS;   // 001
private static final int TIDYING    =  2 << COUNT_BITS;   // 010
private static final int TERMINATED =  3 << COUNT_BITS;   // 011

// 从一个 int 里拆出状态 / 线程数，或拼回去
private static int runStateOf(int c)     { return c & ~CAPACITY; }  // 取高 3 位
private static int workerCountOf(int c)  { return c & CAPACITY; }   // 取低 29 位
private static int ctlOf(int rs, int wc) { return rs | wc; }        // 状态 | 线程数 拼回去
```

高 3 位存状态，低 29 位存线程数（最多约 5 亿个线程，绝对够用）。读用位运算拆开，写用一次 CAS 同时更新——**不会出现"状态变了、线程数还没跟上"的中间态**。

要是拆成两个字段，改的时候就得先改一个再改另一个，中间被别的线程插队就乱了，只能上锁；塞进一个 int，连锁都省了。

---

# 四、这些字段为什么都是 `volatile`？

这里本质是要搞清楚内存模型。当我们在主线程修改一个共享变量的时候。虽然从逻辑上看着是修改了。但是从硬件上来看，此时内存地址并没有发生变化，只在主线程所在的L1缓存里的值发生了变化。（这里和硬件架构实现有关系，这里只是列出其中一种）。那么从另一个线程来看，这里完全就是没有修改。

在最开始的时候，我总以为这里和变量的原子性有关，我想那为啥不用atomic呢。后来发现这里其实本质是变量的可见性。
因为这里本质上并不存在数据race的问题。

**一句话答：它们被一个线程改、被另一个线程频繁读，`volatile` 保证读的那边立刻看到新值。**


# 五、队列为什么最好都用有界的？

**一句话答：无界队列没有上限，慢任务堆积时会把内存吃满，直到 OOM；有界队列才有真正的"限流"作用。**

```text
new LinkedBlockingQueue<>()    默认容量 = Integer.MAX_VALUE ≈ 21 亿 → 实际等于无界
new ArrayBlockingQueue<>(1000) 必须指定容量 → 有界
```

无界队列可怕在它"永远不满"：既不触发扩容、也不触发拒绝，任务就这么无声无息地堆下去，直到 `OutOfMemoryError` 把进程干掉。

这里可以回顾开头的流程，要明白线程池在什么的时候才会用到MaxPoolSize，只有当CoreSize满了之后，且队列满了之后才会用到MaxPoolSize。

所以Ali规范才默认拒绝了Executors的创建。

# 六、拒绝策略该怎么设？

**一句话答：队列满、线程也满时新任务怎么办——四种内置策略各有场景，生产上常用反压或自定义，别用静默丢弃。**

```text
AbortPolicy(默认)     抛 RejectedExecutionException。任务不能丢、要立刻暴露问题时用。
CallerRunsPolicy      谁提交谁自己跑。天然的反压 / 降级，把压力顶回上游。
DiscardPolicy         静默丢弃。基本别用，出问题没人知道。
DiscardOldestPolicy   丢掉队列里最老的任务再塞新的。适合"新的更重要"(如实时行情)。
```

生产建议：优先 `CallerRunsPolicy`(反压)，或自定义一个"记日志 + 降级 + 告警"的 handler。

> 回到故障：如果当时有合理的拒绝策略 + 监控，慢任务把池子占满后，至少会被拒绝或反压顶回去，而不是让旁路逻辑悄悄把关键路径拖死。

> 注意：`CallerRunsPolicy` 的"谁提交谁跑"——如果提交线程是 Tomcat 的请求处理线程，反压会直接拖慢整条请求链路。反压是好事，但要清楚被压的到底是谁。

---

# 七、`maximumPoolSize` 到底什么时候才会用到？

**一句话答：只有当队列满了之后，才会去开超过 corePoolSize 的线程，一直开到 maximumPoolSize。** 顺序就是 § 一那张图：核心线程 → 队列 → 非核心线程(到 max) → 拒绝。

这就带来一个经典坑：

```text
如果用无界队列（如 LinkedBlockingQueue 默认）
    ↓
队列永远不满
    ↓
maximumPoolSize 永远用不到
    ↓
"最大线程数"形同虚设
```

`Executors.newFixedThreadPool` 就是反例：它内部用无界队列，所以 `maximumPoolSize` 看着有值，**其实永远不会触发扩容**。

所以"队列有没有界"和"`maximumPoolSize` 会不会被用到"是绑在一起的——这也回答了 § 五为什么队列要选有界：**只有有界队列，最大线程数才真正有意义。**

---

# 八、线程池该怎么拆分（隔离）？

1. **绝对不能和主链路在一个池子，绝对不能影响关键路径**
2. 一般来说，最好是每做一个任务，自己起一个池子。除非你能明确确定这个任务的重要性之前，不然尽量不要共享线程池。

故障的直接教训就是这条：开通租户这种又慢、又会被反复触发的**旁路任务**，和主业务请求共用一个池，旁路一堵，关键路径跟着陪葬。

# 九、线程池要监控哪些指标？

**一句话答：一个不监控的池就是黑盒，出事只能盲猜。盯住队列堆积、活跃线程数、拒绝次数这几个指标，就能提前发现问题。**

ThreadPoolExecutor 自带的几个读取方法，就是现成的监控数据源：

```text
getActiveCount()         正在执行任务的线程数
getQueue().size()        队列里堆积的任务数
getTaskCount()           累计提交的任务数
getCompletedTaskCount()  累计完成的任务数
getLargestPoolSize()     历史峰值线程数
```

生产上把这些指标报到监控平台（Prometheus 之类），重点盯三个信号：

```text
队列堆积量   → 持续涨，说明处理不过来，该扩容 / 降级了
活跃线程数   → 一直顶在 maximumPoolSize，说明池子已到极限
拒绝次数     → 突然涨，说明流量超出预期（需要拒绝策略能计数）
```
---

# 十、积累到面试中

针对这个点，其实我之前从没想过这么细。但是最近大家一直在讨论复利的思想，其实对于我来说，我踩过的这些坑，都是我自己的经验。所以我认为应该积累起来。
让它真正成为你在面试中可以拿出来讨论的，证明你是认真思考，认真研究过的。

**暴露的问题：**

### 1. 池子没隔离         
旁路慢任务和核心业务共用一个池，旁路一堵，核心业务陪葬。旁路逻辑影响主链路，是非常大的架构问题。

不仅仅在线程池中，在做其他逻辑的时候也要反思这个问题。

### 2. 队列无界 
这里的本质是对Java线程池的理解不对，以为设置了MaxPoolSize就没有问题了，实际上使用无界队列后，MaxPoolSize根本不会生效。

### 3. 异常策略和监控
这里其实也是一个缺少Guard思维，对于线程池里的监控和异常也要搭建起来
4. 入口没防重复        可重入任务被放大几十倍重复触发，压力在源头就被放大


---

# 十一、拓展：为什么 Go 很少踩"共享变量看不见"这个坑？

写到这你可能会想：前面又是 `volatile`、又是内存模型，这么麻烦，怎么 Go 写并发就没这种感觉？

因为 Go 从根上就是另一种打法，一句话：

> **不要通过共享内存来通信，而要通过通信来共享内存。**

所以go很少出现这样的共享变量的想法，大多都是channel进行通知。