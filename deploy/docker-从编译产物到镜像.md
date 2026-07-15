# 从编译产物到镜像:Dockerfile 打包实战

> 你写完了代码、编译出了产物(二进制 / JAR / 前端包),离"能在任何机器上跑"就差一步 —— **把它打包成 Docker 镜像**。
>
> 这篇讲怎么把"编译产物"变成"生产级镜像"。核心其实就一个词:**多阶段构建**。

---

## 0. 所谓部署，是在部署什么?

众所周知,代码写完、编译之后,会产出一个**可运行的产物(artifact)**:

- **Go** → 一个二进制文件(`myapp`)
- **Java** → 一个 JAR 包(`app.jar`)
- **前端** → 一堆静态文件(`dist/`)

这些运行的产物，是可以直接执行的，就会执行可以启动一个进程（jar包依赖jvm）。此时，我们的程序就在本地启动了，常常我们测试或者联调的时候通过这个方式来处理。

这个产物,就是真正要去运行的东西。而**打包成镜像**,本质上就是把它(连同运行环境)封进一个标准盒子里:

```
   源码 ──编译──> 产物(artifact)──打包──> 镜像(image)
```

部署的本质就是在部署这个镜像。 那么问题来了, 这个部署该怎么做呢

---

## 1. 本地构建产物为什么不好？

**做法 A:本地编译好,把二进制 COPY 进镜像**

你本地 `go build` 出了 `myapp`,然后:

```dockerfile
FROM alpine:3.19
COPY myapp .          # 直接拷本地编译好的二进制
CMD ["./myapp"]
```

简单,但有个**致命陷阱:本地构建环境和镜像运行环境不一致**,二进制可能根本跑不起来:

- **编译器版本不一致** —— 本地用 Go 1.21 编译,运行环境却是 1.16 → 行为异常甚至直接起不来
- **操作系统不一致** —— 你在 macOS 上编出的是 darwin 二进制,扔进 Linux 镜像 → `exec format error`
- **C 库不一致** —— 在普通 Linux(glibc)上编译,扔进 alpine(musl)→ 找不到动态库,报错

> 一句话:**本地"能跑"不代表镜像里"能跑"** —— 没控制住编译环境,产物和运行环境对不上,镜像就部署不出去。这正是"在我电脑上能跑"的容器版。

**做法 B:干脆在镜像里编译(单阶段)**

为了环境一致,那就把源码拷进镜像、在镜像里编译:

```dockerfile
FROM golang:1.22
WORKDIR /app
COPY . .
RUN go build -o myapp .        # 在镜像里编译,环境可控
CMD ["./myapp"]
```

环境一致的问题解决了,却换来新的麻烦:

- **镜像巨大** —— 带着整个 Go 工具链 + 全部源码,动辄几百 MB,运行时根本用不到
- **不安全** —— 镜像里带着编译器、shell、各种工具,生产环境攻击面白白多一大块
- **慢** —— 每次构建都拉大镜像、装工具链

> 卡住了:做法 A **环境不一致**(跑不起来),做法 B **环境一致但臃肿不安全**。能不能**既要环境一致、又要小而安全**?—— 这就轮到多阶段构建登场。

> 
---

## 2. 解法:把"编译"和"运行"分开 —— 多阶段构建

做法 A 死在"环境不一致",做法 B 死在"臃肿不安全"。多阶段构建**两边的便宜都占** —— 在受控的构建阶段里编译(保证环境一致),只把产物带到最小运行镜像(小而安全)。

核心思想:**用一个阶段专门编译,另一个阶段只放产物**。最终镜像只保留最后一个阶段,前面的阶段"用完即弃"。

```dockerfile
# ---- 阶段 1:构建(builder)----
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o myapp .

# ---- 阶段 2:运行(runtime)----
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/myapp .     # 只把产物拷过来
CMD ["./myapp"]
```

```
   ┌──── 阶段 1:builder(用完即弃)─────┐
   │  Go 工具链 + 源码                   │
   │       ↓ go build                    │
   │     产物:myapp(二进制)            │  ← 只取这一个
   └─────────────────┬───────────────────┘
                     │ COPY --from=builder
                     ▼
   ┌──── 阶段 2:runtime(最终镜像)────┐
   │  alpine + myapp                     │  ← 这才是跑生产的
   └─────────────────────────────────────┘
```

效果立竿见影:

```
   朴素(单阶段):  golang + 源码 + 工具链 + 二进制   ≈ 800 MB
   多阶段(alpine): alpine + 二进制                  ≈ 20 MB   ⭐
```

**为什么要追求小?三个字:快、省、安全。**

- **快** —— 镜像小,拉取 / 推送快,Pod 启动快(800MB 拉 ~40s,20MB ~2s),扩容、滚动更新都跟着快
- **省** —— 镜像仓库按容量收费、跨地域拉取走带宽,小镜像省钱
- **安全** —— 包少 = 攻击面小、CVE 少;distroless / scratch 连 shell 都没有,攻进来也难搞破坏

> 关键就是 `COPY --from=builder` 这一行 —— 跨阶段拷贝。前面的 builder 阶段只是"借来编译用",**最终镜像根本不包含它**。一个 Dockerfile,`docker build` 一条命令搞定。

---

## 3. 不同语言的产物 → 不同套路

核心都一样(编译阶段 + 运行阶段),只是"运行阶段放什么"因语言而异:

| 产物类型 | 运行时依赖 | 最终阶段用什么 |
|---|---|---|
| Go / Rust 静态二进制 | 无 | `scratch` 或 `alpine` |
| C/C++ 动态二进制 | libc 等动态库 | `alpine` / `debian-slim` |
| Java JAR | JVM | `eclipse-temurin:21-jre`(**只要 JRE,别带 JDK**) |
| 前端静态包 | Web 服务器 | `nginx`(把 dist 喂给它) |

**Java 例子**(JAR → JRE):

```dockerfile
FROM maven:3.9 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline          # 先装依赖(利用缓存,见第 4 节)
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine     # 只要 JRE,不要 JDK
COPY --from=builder /app/target/*.jar /app.jar
CMD ["java", "-jar", "/app.jar"]
```

**Java 的特殊之处:跨平台,但镜像很难做小。**

- **JAR 是跨平台字节码**(不像 Go 编译成原生二进制),运行时**必须带 JVM** —— 所以 Java 镜像再优化也下不来到 Go 的 10MB,这是 Java 的宿命。
- **JVM 本身就大**:一个 JRE 即使是 alpine 版也要 ~100MB+,加上应用,Java 镜像常常 **200MB+**。
- **fat JAR 更糟**:Spring Boot 把所有依赖打进一个超大 JAR(动辄 50~100MB),而且改一行代码整个 JAR 层都变,缓存失效。

Java 镜像的常见瘦身手段:

| 手段 | 效果 |
|---|---|
| 用 JRE 不用 JDK | 砍掉编译器等(基础操作) |
| `eclipse-temurin:*-jre-alpine` | alpine 版比 debian 版小很多 |
| **分层 JAR**(Spring Boot layered jar) | 依赖层 / 应用层分开,依赖不变可缓存 |
| **jlink** | 裁剪出只含所需模块的迷你 JRE |
| **GraalVM Native Image** | 编译成原生二进制,能像 Go 一样上 scratch(但反射配置麻烦、编译慢) |

> 一句话:**Java 因为必须带 JVM,镜像天生比 Go 大;但用 JRE-alpine + 分层 JAR + jlink,也能压到可接受的范围。**

**前端例子**(构建产物 → nginx 托管):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build                      # 产出 dist/

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

> 规律:**运行阶段只装"跑产物必需的最小运行时"** —— Java 只装 JRE,前端只装 nginx,Go 干脆什么都不装。

---

## 4. 打包好镜像的几个习惯

- **`.dockerignore`** —— 把 `node_modules`、`.git`、测试数据挡在构建上下文之外,别让它们进镜像
- **小的基础镜像** —— 优先 `alpine` / `-slim` / `distroless`,体积和安全双赢
- **依赖先拷、源码后拷** —— 利用层缓存(依赖没变就跳过重装那一层,构建快很多)
- **非 root 用户运行** —— 安全:`USER appuser`
- **合并 `RUN`** —— 多条命令用 `&&` 串起来,减少层数

> 其中**"依赖先拷、源码后拷"**最值得记住 —— 看第 3 节的 Java 例子,`COPY pom.xml` + 装依赖在前面,`COPY src` 在后面。源码天天变,依赖很少变,这样源码改动时不会触发"重装所有依赖"那层,构建飞快。

---

## 5. 镜像做好了,运行配置怎么办?

镜像只装"程序",但程序启动往往依赖**运行时配置** —— 数据库连接、各种业务参数。这些该放哪?

**核心原则:配置不要打进镜像。**

- **多环境**:同一镜像要跑 dev / test / prod,配置全不同 —— 打进镜像就僵死了
- **安全**:密码打进镜像,等于把保险柜钥匙焊死在门上(镜像推到仓库,谁都能扒出来)
- **解耦**:改个配置不该重新打镜像 —— 镜像应该是**不可变(immutable)**的

那配置从哪来?**运行时从外部注入。** 实际最常用的是 —— **挂载配置文件**。

### 主流做法:挂载配置文件(能查看、能核对)

把宿主机的配置文件挂进容器:

```bash
docker run -v ./config.yaml:/app/config.yaml myapp:1.0
```

程序通常还要知道"去哪读配置",所以再给一个**指向路径**的环境变量:

```bash
docker run -e CONFIG_FILE=/app/config.yaml \
           -v ./config.yaml:/app/config.yaml \
           myapp:1.0
```

- 环境变量 = 告诉程序"配置文件在哪"(只是个路径)
- 挂载 = 真正把配置内容塞进去

**为什么这种方式最常用?** 因为配置文件**能直接看、能核对** —— 你可以 `cat /app/config.yaml` 确认容器里跑的到底是不是你刚改的那份,验证改动生效了没有。要是配置散成一堆 `-e`,根本没法一眼核对。

### 多容器编排:docker-compose 挂载

```yaml
services:
  app:
    image: myapp:1.0
    volumes:
      - ./config.yaml:/app/config.yaml      # 挂配置文件
    environment:
      CONFIG_FILE: /app/config.yaml         # 配置路径
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: s3cret
```

**同一镜像,不同环境只换挂进去的配置文件**(dev 挂 `config-dev.yaml`,prod 挂 `config-prod.yaml`)。镜像不变,变的只是配置文件 —— 这就是"镜像 immutable、配置外部化"。

### 简单配置:环境变量 `-e`

少量、简单的配置(比如 `LOG_LEVEL=debug`、`ENV=prod`),直接用环境变量就行:

```bash
docker run -e LOG_LEVEL=debug myapp:1.0
```

但配置一多、一复杂,`-e` 就不好用了 —— 散在命令里难查看、难核对,这时就回到上面的**文件挂载**。

### 敏感信息(密码、密钥)

绝不进镜像,也别明文提交 Git:
- 放进 `.env` 文件,并把 `.env` **加进 `.gitignore`**
- 生产环境的密码管理、动态热更新配置等更高级做法,**留到下一章 K8s 讲**(Secret、配置中心 Nacos)

> 一句话:**复杂配置用文件挂载(能查看、能核对),简单配置用环境变量。** 镜像定型(immutable),配置随环境变。

---

## 6. 一句话总结

> 打包镜像的本质 = **只把"运行需要的"放进镜像,其余(编译器、源码、构建工具)全部留在构建阶段**。

多阶段构建就是干这个的:一个 Dockerfile 里分两段,**前段编译、后段运行**,`COPY --from` 把产物带过去。最终镜像又小又安全 —— 这就是从"编译产物"到"生产级镜像"的标准姿势。

```
   产物 + 运行时  ──COPY --from──>  最终镜像(小而安全)
   (构建阶段产出)                    (只有这一个会被推送/部署)
```
