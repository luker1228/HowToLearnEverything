可以把整个登录体系理解成一条不断解决新问题的演进链：

```text
用户名密码
   ↓
每次请求都传密码，太危险
   ↓
Session
   ↓
浏览器需要自动携带 Session ID
   ↓
Cookie
   ↓
分布式系统、移动端、第三方应用出现
   ↓
Access Token
   ↓
Access Token 太短，需要保持长期登录
   ↓
Refresh Token
   ↓
Token 需要一种可验证的数据格式
   ↓
JWT
   ↓
第三方应用如何规范地获得 Token
   ↓
OAuth
   ↓
OAuth 只解决授权，不完整解决登录
   ↓
OIDC
```

不过这里需要强调：

> 这不是简单的“新技术完全替换旧技术”，而是应用场景不断扩大后，各种机制组合起来。

---

# 第一阶段：只有用户名和密码

最原始的认证方式很直接。

用户每次请求都发送用户名和密码：

```http
GET /api/orders
Authorization: Basic base64(username:password)
```

服务端每次：

```text
解析用户名密码
    ↓
查询用户数据库
    ↓
校验密码
    ↓
确认用户身份
    ↓
处理业务请求
```

流程是：

```text
浏览器                       服务端
   │                           │
   │ 用户名 + 密码             │
   ├──────────────────────────>│
   │                           │ 校验密码
   │                           │ 处理请求
   │<──────────────────────────┤
```

## 遇到的问题

### 问题一：密码暴露频率太高

每一次请求都传密码：

```text
请求用户信息 → 传密码
请求订单     → 传密码
修改头像     → 传密码
查看消息     → 传密码
```

虽然可以使用 HTTPS 加密传输，但密码仍然：

* 在客户端反复使用；
* 在每个请求中出现；
* 容易被日志、代理或错误代码处理不当；
* 一旦泄漏，攻击者获得的是长期主凭证。

### 问题二：每次都要验证密码

密码通常不会明文存储，而是存储慢哈希，例如：

```text
Argon2
bcrypt
scrypt
```

密码校验本来就故意设计得比较慢。如果每个请求都做密码哈希验证，成本很高。

这里容易误解成：

> 数据库里已经有“密文”了，为什么不直接拿用户传来的密码和数据库里的密文比较？

关键点是：真实系统通常不存“可解密的密文”，而是存“不可逆的密码哈希”。

登录时流程是：

```text
用户输入的明文密码
    ↓
使用同样的算法和参数重新计算哈希
    ↓
拿计算结果和数据库中的密码哈希比较
```

数据库里存的通常类似：

```text
$argon2id$v=19$m=65536,t=3,p=4$...
```

它不是把密码加密后的结果，不能解密回原密码。服务端只能用“用户这次输入的密码”再算一次哈希，然后比较结果是否一致。

所以“直接拿密文匹配”在密码哈希场景下并不存在。真正能比较的是：

```text
hash(用户这次输入的密码) == 数据库里保存的 password_hash
```

而 Argon2、bcrypt、scrypt 这类算法故意很慢，目的是让攻击者拿到数据库后也很难快速暴力猜密码。但副作用是：如果每个业务请求都要重新验证密码，就会把这个高成本操作重复很多次。

### 问题三：无法方便地管理登录状态

系统很难回答：

```text
用户什么时候登录的？
从哪台设备登录的？
这次登录是否已经退出？
是否需要强制下线？
```

于是产生一个需求：

> 密码只在登录时验证一次，登录成功后换一个临时凭证。

这就引出了 Session。

---

# 第二阶段：引入 Session

先把几个基础概念说清楚。

Session 的本质是：

> 服务端保存的一份登录状态。

例如服务端保存：

```text
session_id=abc123 → userId=10001
```

它的意思是：只要后续请求能带上 `abc123`，服务端就知道这是用户 `10001` 的一次已登录请求。

但是 HTTP 请求本身是无状态的。也就是说，服务端天然不会记得：

```text
上一次请求是谁发的？
这一次请求和上一次请求是不是同一个用户？
```

所以 Session 需要一个客户端能携带的编号，这就是 Session ID。

Session 和 Session ID 的关系是：

```text
Session：服务端保存的登录状态
Session ID：这条登录状态的编号
```

还有一个容易混淆的概念是 Cookie。

Cookie 的本质不是 Session，它是浏览器提供的一套机制：

> Cookie = HTTP Header 约定 + 浏览器本地存储 + 浏览器自动携带。

具体来说：

```http
Set-Cookie: session_id=abc123
```

这是服务端通过 HTTP 响应头告诉浏览器：

```text
请把 session_id=abc123 保存起来。
```

之后浏览器访问同一个站点时，会自动在请求头里带上：

```http
Cookie: session_id=abc123
```

所以 Cookie 解决的是：

> 浏览器怎样保存并自动携带 Session ID？

而 Session 解决的是：

> 服务端怎样在多次 HTTP 请求之间识别同一个已登录用户？

用户第一次登录：

```http
POST /login

{
  "username": "luke",
  "password": "123456"
}
```

服务端校验成功后，在服务端创建一条 Session：

```text
session_id = abc123
```

服务端存储：

```json
{
  "abc123": {
    "userId": "10001",
    "roles": ["user"],
    "loginTime": "2026-07-20T17:00:00",
    "expiresAt": "2026-07-27T17:00:00"
  }
}
```

以后客户端不再发送密码，只发送：

```text
session_id=abc123
```

服务端根据 Session ID 查询：

```text
abc123 → userId 10001
```

完整流程：

```text
第一次登录：

用户名 + 密码
      ↓
服务端验证
      ↓
创建 Session
      ↓
返回 Session ID


后续请求：

Session ID
      ↓
查询 Session
      ↓
知道当前用户是谁
```

## Session解决了什么

它解决了：

```text
密码不用反复传输
密码不用反复校验
服务端可以管理登录状态
服务端可以主动让用户退出
```

例如强制退出非常简单：

```text
删除 session:abc123
```

下一次请求，这个 Session ID 就失效了。

---

# 第三阶段：Session ID 怎么自动携带

现在又出现一个问题：

> 浏览器怎样在每次请求时自动携带 Session ID？

总不能每个前端请求都手动写：

```ts
fetch("/api/orders", {
  headers: {
    "X-Session-ID": "abc123",
  },
});
```

于是浏览器中的 Cookie 机制非常适合承担这个任务。

登录成功后，服务端返回：

```http
Set-Cookie: session_id=abc123;
HttpOnly;
Secure;
SameSite=Lax;
Path=/
```

浏览器保存以后，后续请求自动携带：

```http
GET /api/orders
Cookie: session_id=abc123
```

于是形成经典的 Web 登录结构：

```text
用户名 + 密码
      ↓
服务端创建 Session
      ↓
Session ID 放进 Cookie
      ↓
浏览器自动携带 Cookie
      ↓
服务端查询 Session
      ↓
识别当前用户
```

这里要分清：

```text
Session：服务端保存的登录状态
Session ID：这条状态的编号
Cookie：浏览器保存和传递 Session ID 的方式
```

一个经典组合就是：

```text
Cookie + Session
```

---

# 第四阶段：传统 Session 遇到了新问题

对于单体 Web 应用，Cookie + Session 非常好用。

但后来系统开始变化。

## 问题一：服务端越来越多

以前只有一台服务器：

```text
浏览器 → Server A
```

Session 放在 Server A 内存里没有问题。

后来变成多台服务器：

```text
              ┌→ Server A
浏览器 → LB ──┼→ Server B
              └→ Server C
```

用户登录请求落到 Server A：

```text
Server A 内存：
abc123 → user10001
```

下一次请求落到 Server B：

```text
Server B：
找不到 abc123
```

解决办法通常是把 Session 放到共享存储：

```text
Server A ─┐
Server B ─┼→ Redis
Server C ─┘
```

这样任何服务器都可以查询 Session。

这并不是不能解决，只是增加了：

* Redis依赖；
* 一次额外查询；
* Session同步；
* 高可用和容量管理；
* 跨地域访问成本。

## 问题二：出现大量微服务

系统从一个后端变成：

```text
API Gateway
   ├── 用户服务
   ├── 订单服务
   ├── 商品服务
   └── 支付服务
```

每个服务都需要知道：

```text
当前用户是谁？
有什么权限？
```

如果每个服务都查询 Session：

```text
订单服务 → Session中心
商品服务 → Session中心
支付服务 → Session中心
```

各服务和 Session 中心之间产生较强依赖。

## 问题三：客户端不再只有浏览器

出现了：

* 手机 App；
* 桌面客户端；
* CLI；
* 小程序；
* 智能电视；
* 服务端程序。

这些客户端虽然也可以自己实现 Cookie，但 Cookie 最自然的使用环境仍然是浏览器。

对于 API 客户端，人们更希望有一种明确的方式：

```http
Authorization: Bearer <credential>
```

## 问题四：第三方应用需要访问 API

例如 SchemaX 想访问用户的 GitHub 仓库。

不可能让用户把 GitHub 的 Session Cookie 直接交给 SchemaX，因为：

* Cookie可能代表完整账号权限；
* Cookie和浏览器登录状态绑定；
* 无法方便地限制权限；
* 第三方拿到后可能冒充用户访问整个网站；
* 很难指定只允许读取仓库。

这时需要一种专门给 API 使用的、权限受限的凭证。

于是引出了 Access Token。

---

# 第五阶段：引入 Access Token

Access Token 的目标是：

> 给客户端一张可以访问特定 API、拥有特定权限、在一定时间后自动失效的通行证。

例如：

```text
用户：10001
目标API：order-api
权限：order:read
有效期：15分钟
```

客户端调用 API：

```http
GET /api/orders
Authorization: Bearer AT1
```

API 验证 Access Token 后处理请求。

流程变成：

```text
用户名 + 密码
      ↓
认证服务器验证用户
      ↓
签发 Access Token
      ↓
客户端携带 Access Token
      ↓
API 验证 Token
      ↓
处理请求
```

## Access Token相比传统Session带来了什么

### 可以明确限制给哪个API

例如：

```text
aud = order-api
```

订单 Token 不能拿去调用用户管理 API。

### 可以明确限制权限

例如：

```text
scope = order:read
```

只允许读取订单，不允许删除订单。

### 更适合非浏览器客户端

统一使用：

```http
Authorization: Bearer <access_token>
```

手机 App、CLI、后端服务都可以使用。

### 更适合跨服务传递

例如：

```text
前端
  ↓ Access Token
API网关
  ↓ Access Token
订单服务
```

服务可以根据 Token 判断用户身份和权限。

---

# 第六阶段：Token 不一定是 JWT

这里特别容易混淆。

Access Token 最简单可以是一个随机字符串：

```text
AT1 = x7a9k2m8p
```

认证服务器保存：

```json
{
  "x7a9k2m8p": {
    "userId": "10001",
    "scope": ["order:read"],
    "expiresAt": "..."
  }
}
```

API拿到 Token 后，去认证服务器查询：

```text
x7a9k2m8p 是否有效？
代表谁？
有什么权限？
```

这种叫：

```text
Opaque Token，不透明令牌
```

本质上它和 Session ID 很像：

```text
它只是一个随机索引
真正的数据仍然在服务端
```

所以 Token 并不天然等于“无状态”。

---

# 第七阶段：Token 验证中心又成为瓶颈

如果 Access Token 是随机字符串，每个服务都需要询问认证服务器：

```text
订单服务 ──→ Token验证中心
商品服务 ──→ Token验证中心
支付服务 ──→ Token验证中心
```

这又产生问题：

* 每次请求多一次网络调用；
* Token验证中心成为关键依赖；
* 认证服务压力增大；
* 如果认证服务不可用，业务API可能都无法验证Token。

于是产生一个想法：

> 能不能把必要的信息直接放进 Token，并使用数字签名防止篡改？

这就引出了 JWT。

---

# 第八阶段：引入 JWT 格式

JWT 可以把身份和权限信息放在 Token 中：

```json
{
  "iss": "https://auth.example.com",
  "sub": "user-10001",
  "aud": "order-api",
  "scope": "order:read",
  "exp": 1784500900
}
```

认证服务器使用私钥签名：

```text
Header.Payload.Signature
```

API拿到JWT后，可以用公钥独立验证：

```text
验证签名
检查签发者 iss
检查接收者 aud
检查过期时间 exp
检查权限 scope
```

不一定需要每次查询认证服务器。

流程变成：

```text
认证服务器
   │ 使用私钥签发 JWT
   ▼
客户端持有 JWT Access Token
   │
   ▼
订单服务使用公钥验证
商品服务使用公钥验证
支付服务使用公钥验证
```

## JWT解决了什么

```text
API可以本地验证
降低认证中心的实时查询压力
适合分布式和微服务系统
便于在多个服务之间传递声明
```

## 但JWT又带来了新问题

JWT一旦签发，在到期前通常可以独立验证。

假设JWT有效15分钟：

```text
用户已经被管理员禁用
但是旧JWT还剩10分钟
```

如果API只检查签名，那么旧JWT可能继续使用10分钟。

所以JWT的问题是：

```text
容易验证
不容易立即撤销
```

解决办法通常是：

* Access Token有效期设置得较短；
* 关键请求实时查询用户状态；
* 使用黑名单；
* 使用Token版本；
* API网关集中校验；
* 重要权限不完全相信Token里的旧数据。

因此：

> JWT解决的是分布式验证问题，不是所有登录问题。

---

# 第九阶段：Access Token 设置很短，又出现续期问题

为了降低Access Token泄漏风险，一般会让它短期有效：

```text
Access Token：15分钟
```

但是如果每15分钟就让用户重新输入密码：

```text
登录
15分钟后重新登录
再过15分钟又重新登录
```

用户体验非常差。

于是需要另一个长期凭证：

```text
Refresh Token
```

形成双Token结构：

```text
Access Token
短期，用于访问API

Refresh Token
长期，用于获得新的Access Token
```

流程：

```text
用户名 + 密码
      ↓
签发 Access Token + Refresh Token
      ↓
使用 Access Token 调 API
      ↓
Access Token 过期
      ↓
使用 Refresh Token 换新 Access Token
      ↓
继续调用 API
```

## 为什么需要两个Token

因为它们的暴露范围不同。

Access Token频繁出现在：

```text
浏览器 → API网关
API网关 → 业务服务
业务服务 → 下游服务
```

所以暴露概率相对较高，应该短期有效。

Refresh Token只应发送给认证服务器：

```text
客户端 → /token 或 /refresh
```

使用频率低、保存要求高。

可以理解为：

```text
Access Token = 临时门票
Refresh Token = 续办临时门票的长期凭证
```

---

# 第十阶段：Refresh Token 也会被偷

Refresh Token生命周期较长。如果被攻击者拿到，攻击者可以不断换取新的Access Token。

于是引入：

```text
Refresh Token Rotation
```

第一次：

```text
RT1 → AT2 + RT2
```

RT1立即失效。

下一次：

```text
RT2 → AT3 + RT3
```

如果RT1后来又被使用：

```text
RT1 再次出现
```

服务端就知道可能出现了泄漏或重放攻击，可以撤销整个登录会话。

所以现代结构通常是：

```text
短期 Access Token
长期但轮换的 Refresh Token
```

---

# 第十一阶段：第三方应用怎样获得 Token

到这里，Token已经可以解决API访问问题，但又出现一个更大的问题。

假设 SchemaX 想读取用户的 GitHub 仓库。

SchemaX需要获得GitHub的Access Token，但不能：

```text
让用户把GitHub密码交给SchemaX
```

所以需要标准化以下过程：

```text
SchemaX怎么申请权限？
用户在哪里同意？
GitHub怎么返回临时凭证？
SchemaX怎么换取Access Token？
Access Token有哪些权限？
如何刷新？
如何撤销？
```

这套标准化的授权流程就是：

```text
OAuth 2.0
```

OAuth本身不是某一种Token，也不是JWT。

OAuth规定的是：

> 客户端如何在用户授权后获得Access Token，并使用Access Token访问资源。

---

# 第十二阶段：OAuth 只解决授权，登录仍然不够

OAuth主要回答：

```text
SchemaX可以访问用户的哪些GitHub资源？
```

例如：

```text
允许读取仓库
不允许删除仓库
```

但“使用GitHub登录SchemaX”还需要回答：

```text
在GitHub完成认证的用户到底是谁？
这个身份结果是不是签发给SchemaX的？
认证是什么时候完成的？
```

OAuth本身并没有完整标准化登录身份信息。

于是OAuth之上增加了一层：

```text
OpenID Connect，OIDC
```

OIDC引入：

```text
ID Token
```

它告诉客户端：

```text
用户已经完成认证
用户唯一标识是 sub
这个认证结果签发给当前客户端
```

于是：

```text
OAuth：应用被允许访问什么
OIDC：当前登录的用户是谁
```

---

# 最终把整条链串起来

## 1. 最初只有密码

```text
每次请求都发送用户名和密码
```

问题：

```text
密码反复暴露
每次都要验证密码
不能方便管理登录状态
```

## 2. 引入Session

```text
密码只在登录时验证一次
服务端创建Session
客户端以后只传Session ID
```

解决：

```text
不用反复传密码
服务端可以管理登录状态
```

## 3. 使用Cookie传Session ID

```text
Session ID放在Cookie里
浏览器每次自动携带
```

解决：

```text
前端不需要手动附加Session ID
```

## 4. 出现分布式系统和API客户端

问题：

```text
多服务器需要共享Session
微服务频繁查询Session
手机、CLI和第三方应用不适合依赖浏览器Cookie
需要限制API访问范围
```

## 5. 引入Access Token

```text
客户端使用Access Token调用API
Token可以限制目标API、权限和有效期
```

解决：

```text
适合API和非浏览器客户端
适合跨服务授权
支持细粒度权限
```

## 6. Token验证又依赖中心服务

问题：

```text
如果Token只是随机字符串
每个API都需要查询认证中心
```

## 7. 使用JWT格式

```text
身份、受众、权限、有效期放入Token
认证服务器签名
API本地验证
```

解决：

```text
分布式服务可以独立验证
```

代价：

```text
已签发Token不容易立即撤销
Token中的权限可能短期过时
```

## 8. Access Token太短

问题：

```text
频繁要求用户重新登录
```

## 9. 引入Refresh Token

```text
Access Token短期访问API
Refresh Token长期换取新Access Token
```

解决：

```text
安全性和登录体验之间取得平衡
```

## 10. 第三方应用需要标准流程

问题：

```text
第三方怎样安全申请权限和获取Token？
```

## 11. 引入OAuth

```text
OAuth规范授权、Code交换、Token签发、Scope等流程
```

## 12. OAuth不能完整表示用户登录身份

问题：

```text
客户端还需要标准化地确认用户是谁
```

## 13. 引入OIDC

```text
OIDC在OAuth之上增加身份认证和ID Token
```

---

# 一张完整主线图

```text
用户名 + 密码
    │
    │ 问题：不能每次请求都发送密码
    ▼
Session
    │
    │ 服务端保存登录状态
    │ 客户端持有 Session ID
    │
    │ 问题：浏览器怎么自动携带 Session ID
    ▼
Cookie
    │
    │ 浏览器自动保存并发送 Session ID
    │
    │ 问题：分布式、微服务、App、CLI、第三方 API
    ▼
Access Token
    │
    │ 用于访问 API
    │ 支持权限范围和有效期
    │
    │ 问题：每次验证随机 Token 仍需查询中心
    ▼
JWT
    │
    │ Token携带声明并具有签名
    │ API可本地验证
    │
    │ 问题：Access Token太短，频繁重新登录
    ▼
Refresh Token
    │
    │ 用于换取新 Access Token
    │
    │ 问题：第三方如何规范获得这些 Token
    ▼
OAuth 2.0
    │
    │ 标准化授权流程
    │
    │ 问题：OAuth主要解决授权，不完整解决登录身份
    ▼
OIDC
    │
    └── 在 OAuth 上增加身份认证和 ID Token
```

---

# 但现代系统往往不是“Session或Token二选一”

一个现代Web系统很可能同时使用：

```text
浏览器
   │
   │ Cookie + Session ID
   ▼
BFF后端
   │
   │ Access Token
   ▼
业务API
```

BFF内部保存：

```text
Access Token
Refresh Token
```

所以最终组合可能是：

```text
用户名密码：
用于第一次认证

Cookie：
浏览器自动携带凭证

Session：
浏览器和BFF之间维持登录状态

Access Token：
BFF访问业务API

Refresh Token：
Access Token过期时续期

JWT：
Access Token的一种格式

OAuth：
规定Token如何获得和使用

OIDC：
规定用户如何完成登录和身份确认
```

最核心的一句话是：

> 用户名和密码是长期主凭证；Session解决“登录后如何持续识别用户”；Cookie解决“浏览器如何自动携带Session ID”；Access Token解决“客户端如何访问API”；Refresh Token解决“Access Token过期后如何续期”；JWT解决“Token如何携带并防篡改地表达声明”；OAuth解决“客户端如何规范地获得授权Token”；OIDC则在OAuth之上补齐用户登录和身份认证。

延伸总览：[[session-token-oauth-oidc-标准设计]]
