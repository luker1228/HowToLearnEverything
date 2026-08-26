# 三者 compact 架构图（草稿材料）

> 说明：这是一份材料草稿，不是正式成文稿。先把结构、判断和可展开点放在一起，后面再决定怎么改写成文章。

---

## 一、先给一句总判断

这 3 个项目都在做“上下文压缩 / compact”，但抽象层级不一样：

- **deepseek-harness**：偏 **框架内核型 compact**，核心是对当前 session surface 做事务式区间替换。
- **pi**：偏 **session log / transcript 折叠型 compact**，核心是追加 `CompactionEntry`，下次重建上下文时用 summary 替换旧历史。
- **tclaude-code-sourcemap**：偏 **产品运行态恢复型 compact**，不是单一路径，而是“API 清理 + session memory + full compact”三层上下文管理。

可以先把它们理解成三种不同风格：

1. **像内核**：deepseek-harness
2. **像数据结构**：pi
3. **像产品系统**：tclaude-code-sourcemap

---

## 二、三者 compact 架构图

### 1）deepseek-harness

```text
[agent/pre-step]
      │
      ▼
tokenMeter.measure(session)
      │
      ├─ totalTokens < thresholdTokens ───────────────► 不 compact
      │
      └─ totalTokens >= thresholdTokens
                    │
                    ▼
          (optional) toolResultPruner
                    │
                    ▼
      selectCompactableRange(surface, retainTokens)
      │   - 保留尾部
      │   - 不拆 tool call/result
      ▼
summarizeWithLlm(replay prefix + compact instruction)
      │
      ▼
compactSurfaceRegion(...)
      │
      ├─ append compaction/start
      ├─ replace/shadow surface region
      └─ append compaction/end
                    │
                    ▼
               新 surface 生效

[agent/request-error: CONTEXT_WINDOW_EXCEEDED]
      │
      ▼
compactIfNeeded(trigger = context-overflow)
      │
      └─ compact 后 return { kind: "retry" }
```

**一句话理解**：它不是“记一条 summary 备查”，而是**正式修改当前 conversation surface**。

**关键点**：
- step 前做 pressure 检查，而不是等爆了再说。
- 也支持 overflow recovery，真的爆窗后还能 compact + retry。
- summarizer 会尽量复用原请求 prefix，照顾 KV cache / prefix cache。

**关键代码定位**：
- 自动 pressure 触发：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/deepseek-harness/packages/compaction/compaction-basic/src/index.ts:147`
- overflow 恢复：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/deepseek-harness/packages/compaction/compaction-basic/src/index.ts:179`
- 默认阈值/保留比例：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/deepseek-harness/packages/compaction/compaction-basic/src/config.ts:20` `.../config.ts:23` `.../config.ts:144`
- range 选择：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/deepseek-harness/packages/compaction/compaction-basic/src/region.ts:98`
- transaction：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/deepseek-harness/packages/compaction/compaction-basic/src/region.ts:152`
- cache-friendly summarizer：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/deepseek-harness/packages/compaction/compaction-basic/src/summarizer.ts:25` `.../summarizer.ts:145`

#### 伪代码（草稿）

```python
# 自动 pressure 路径
on_pre_step(agent):
    measurement = token_meter.measure(agent.session)
    policy = resolve_target_policy(agent.provider, agent.model)
    spec = resolve_compact_spec(policy, context_window(agent.model))

    if measurement.total_tokens < spec.threshold_tokens:
        return continue_turn()

    if tool_result_pruner is not None:
        tool_result_pruner.prune(agent.session)
        measurement = token_meter.measure(agent.session)
        if measurement.total_tokens < spec.threshold_tokens:
            return continue_turn()

    for _ in range(spec.compaction_retries + 1):
        region = select_compactable_range(
            session=agent.session,
            measurement=measurement,
            retain_tokens=spec.retain_tokens,
        )
        if region is None:
            return continue_turn()

        summary = summarize_with_llm(
            replay_prefix=region.messages,
            system=original_system,
            tools=original_tools,
            instruction=COMPACTION_INSTRUCTION,
        )

        begin_compaction_transaction()
        replace_surface_region_with_checkpoint(region, summary)
        end_compaction_transaction()

        measurement = token_meter.measure(agent.session)
        if measurement.total_tokens < spec.threshold_tokens:
            return continue_turn()

    raise CompactionFailed()


# overflow recovery 路径
on_request_error(agent, failure):
    if failure.code != CONTEXT_WINDOW_EXCEEDED:
        return propagate_error()

    compact_if_needed(agent, trigger="context-overflow")
    return retry_request()
```

---

### 2）pi

```text
[assistant response persisted]
      │
      ▼
_checkCompaction(assistantMessage)
      │
      ├─ overflow / recoverable length
      │        │
      │        ▼
      │   _runAutoCompaction("overflow", willRetry)
      │
      └─ threshold
               │
               ▼
      _runAutoCompaction("threshold", false)
               │
               ▼
      prepareCompaction(pathEntries, settings)
               │
               ├─ find cut point
               ├─ keep recent tail
               ├─ split-turn handling
               ▼
      generateSummary(...) / update previous summary
               │
               ▼
      appendCompaction(summary, firstKeptEntryId, ...)
               │
               ▼
      buildSessionContext()
               │
               ▼
未来请求看到：
[summary] + [firstKeptEntryId 之后的消息]
```

**一句话理解**：它不原地改当前 surface，而是**往 transcript 里追加一条 compaction entry**，以后靠 context rebuild 折叠旧历史。

**关键点**：
- 自动 compact 是在 assistant 响应后检查，不是 step 前检查。
- 默认阈值是 `contextWindow - reserveTokens`。
- 会尽量按 turn 切；如果单个 turn 太大，会进入 split-turn 逻辑。
- summary 请求是独立请求，不刻意复用主会话 cache。

**关键代码定位**：
- `_checkCompaction()`：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/coding-agent/src/core/agent-session.ts:2050`
- threshold 触发：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/coding-agent/src/core/agent-session.ts:2150`
- `_runAutoCompaction()`：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/coding-agent/src/core/agent-session.ts:2166`
- 默认配置：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/agent/src/harness/compaction/compaction.ts:157`
- `shouldCompact()`：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/agent/src/harness/compaction/compaction.ts:246`
- cut point：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/agent/src/harness/compaction/compaction.ts:373`
- summarization prompt：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/agent/src/harness/compaction/compaction.ts:424`
- 独立 summarization 请求：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/pi/packages/agent/src/harness/compaction/compaction.ts:102`

#### 伪代码（草稿）

```python
on_assistant_message_persisted(assistant_message):
    settings = get_compaction_settings()
    if not settings.enabled:
        return

    if is_context_overflow(assistant_message) or is_recoverable_length(assistant_message):
        # overflow 路径：必要时移除最后一个失败 assistant，再 compact，再 retry
        trim_retriable_last_assistant_from_agent_state()
        run_auto_compaction(reason="overflow", will_retry=True)
        return

    context_tokens = calculate_or_estimate_context_tokens(agent_state.messages)
    if context_tokens <= context_window(model) - settings.reserve_tokens:
        return

    run_auto_compaction(reason="threshold", will_retry=False)


run_auto_compaction(reason, will_retry):
    preparation = prepare_compaction(
        entries=current_branch_entries,
        keep_recent_tokens=settings.keep_recent_tokens,
    )
    if preparation is None:
        return

    # preparation 内部会：
    # 1. 倒着累计 token
    # 2. 找 cut point
    # 3. 判断是不是 split turn
    # 4. 取出 messages_to_summarize + retained_tail

    summary = generate_summary(
        current_messages=preparation.messages_to_summarize,
        previous_summary=preparation.previous_summary_if_any,
    )

    append_compaction_entry(
        summary=summary,
        first_kept_entry_id=preparation.first_kept_entry_id,
        tokens_before=preparation.tokens_before,
    )

    rebuilt = build_session_context()
    agent.state.messages = rebuilt.messages

    if will_retry:
        continue_interrupted_turn()
```

---

### 3）tclaude-code-sourcemap

它不是一种 compact，而是三层 compact 栈：

```text
                   ┌─────────────────────────────┐
                   │  Layer 1: API microcompact  │
                   │  - clear tool uses/results  │
                   │  - clear thinking blocks    │
                   └─────────────────────────────┘
                                ▲
                                │
[shouldAutoCompact(messages)] ──┼────────────── threshold reached
                                │
                                ▼
                   ┌─────────────────────────────┐
                   │ Layer 2: session memory     │
                   │ - 用已抽取的 session memory │
                   │   直接生成 compact summary  │
                   └─────────────────────────────┘
                                │ success
                                ▼
                         boundary + summary + keep tail

                                │ fallback
                                ▼
                   ┌─────────────────────────────┐
                   │   Layer 3: full compact     │
                   │ - pre hooks                 │
                   │ - preprocess messages       │
                   │ - stream summary            │
                   │ - PTL retry truncate head   │
                   │ - restore attachments/plan  │
                   │ - boundary + summary        │
                   └─────────────────────────────┘
```

**一句话理解**：它不是单纯的“对话摘要器”，而是**完整的产品级上下文管理系统**。

**关键点**：
- 先尝试最便宜的 API/context-management 路线。
- 再尝试 session memory compact，用已抽取记忆代替一次 full summary。
- 实在不行才 full compact。
- compact 之后不仅恢复消息，还恢复 plan、skill、附件、deferred tools、MCP 指令等运行态信息。

**关键代码定位**：
- auto threshold：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/autoCompact.ts:28` `.../autoCompact.ts:62` `.../autoCompact.ts:72` `.../autoCompact.ts:225`
- 是否启用 auto compact：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/autoCompact.ts:147`
- 先尝试 session memory compact：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/autoCompact.ts:287`
- session memory keep 规则：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/sessionMemoryCompact.ts:57` `.../sessionMemoryCompact.ts:324`
- preserve API invariants：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/sessionMemoryCompact.ts:188`
- full compact 主流程：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/compact.ts:387`
- pre/post hooks：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/compact.ts:406` `.../compact.ts:723`
- strip media/attachments：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/compact.ts:145` `.../compact.ts:211`
- PTL retry：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/compact.ts:243` `.../compact.ts:450`
- API microcompact：`/data/home/lukemxjia/HowToLearnEverything/ai/PI-Agent/tclaude-code-sourcemap/restored-src/src/services/compact/apiMicrocompact.ts:16` `.../apiMicrocompact.ts:63`

#### 伪代码（草稿）

```python
before_next_request(messages, model):
    if not auto_compact_enabled():
        return messages

    token_count = token_count_with_estimation(messages)
    threshold = get_auto_compact_threshold(model)
    if token_count < threshold:
        return messages

    # Layer 1: API microcompact
    # 这层更像“请求上下文编辑策略”，不是本地写 summary
    api_context_management = get_api_context_management(
        has_thinking=session_has_thinking(messages),
        clear_all_thinking=is_cache_cold(),
    )

    # Layer 2: session memory compact
    sm_result = try_session_memory_compaction(
        messages=messages,
        auto_compact_threshold=threshold,
    )
    if sm_result is not None:
        return rebuild_messages_from(sm_result)

    # Layer 3: full compact
    return compact_conversation(messages)


compact_conversation(messages):
    run_pre_compact_hooks()

    messages = strip_images_from_messages(messages)
    messages = strip_reinjected_attachments(messages)

    while True:
        summary = stream_compact_summary(messages)
        if not prompt_too_long(summary):
            break
        messages = truncate_head_for_ptl_retry(messages)
        if messages is None:
            raise CompactionFailed()

    clear_read_file_state()

    attachments = []
    attachments += restore_recent_file_attachments()
    attachments += restore_plan_attachment_if_needed()
    attachments += restore_skill_attachment_if_needed()
    attachments += restore_deferred_tools_delta()
    attachments += restore_agent_listing_delta()
    attachments += restore_mcp_instruction_delta()

    hook_messages = process_session_start_hooks(trigger="compact")
    boundary = create_compact_boundary_message()
    summary_message = create_compact_summary_message(summary)

    run_post_compact_hooks(summary)

    return [boundary, summary_message, *attachments, *hook_messages]
```

---

## 三、优缺点对比

### 1）deepseek-harness

#### 优点
1. **内核味最强，边界最清晰**
   - compact 是正式状态变换，不是临时补丁。
   - 有 `compaction/start` / `compaction/end`，更像事务。

2. **overflow recovery 很完整**
   - 不只是“快满了就压”，还支持真正爆窗后的恢复与 retry。

3. **range 选择很干净**
   - 保留尾部，不拆 tool pair。

4. **适合做多模型框架**
   - policy 能按 provider/model route 计算。

5. **更照顾 cache**
   - summarization 设计上尽量复用原 prefix。

#### 缺点
1. **实现复杂度高**
   - surface、token meter、transaction、overflow retry、policy routing 全都要配合。

2. **对底层抽象依赖很重**
   - 如果系统里没有“surface + event + durable transaction”这层，很难直接搬。

3. **更偏 infra，不偏产品恢复**
   - 它压的是 conversation surface，本身不负责恢复 plan/附件/工具列表等运行态。

#### 适合怎么借鉴
- 适合借鉴它的 **trigger + policy + transactional replace**。

---

### 2）pi

#### 优点
1. **最容易理解**
   - 追加一条 `CompactionEntry`，以后重建上下文时折叠旧历史。
   - 调试、审计、追溯都直观。

2. **和 session tree 很搭**
   - 同一套 transcript 结构还能顺带做 branch summarization。

3. **split-turn 处理认真**
   - 单个 turn 太大时，不是硬切，而是补一个 turn-prefix summary。

4. **扩展接口比较自然**
   - extension 可以在 compact 前拦截、取消、或者提供自定义结果。

#### 缺点
1. **不算最省 token / 最省延迟**
   - summary 请求是独立请求，并且 `cacheRetention: "none"`。

2. **自动 compact 的触发时机偏后**
   - 更像“响应后检查”，不是“调用前主动减压”。

3. **较依赖 token estimate 兜底**
   - usage 缺失时要靠估算，精度不如直接 measure。

#### 适合怎么借鉴
- 适合借鉴它的 **append-only compaction entry + rebuild context**。

---

### 3）tclaude-code-sourcemap

#### 优点
1. **分层设计最好**
   - 先用便宜手段，再用中等成本手段，最后才 full compact。

2. **最贴近真实产品需求**
   - compact 后恢复的不只是摘要，还有运行态附件和工具上下文。

3. **对线上脏场景最有准备**
   - 图片、文档、thinking、tool_result、prompt-too-long retry 都处理得更细。

4. **有很多保护栏**
   - recursion guard、feature flag、circuit breaker 都比较完整。

5. **运营成本意识强**
   - session memory compact 本质上是在用已有记忆资产，降低额外 LLM compact 成本。

#### 缺点
1. **系统最复杂**
   - 路径非常多：microcompact / session memory / full compact / partial compact / reactive compact。

2. **最不容易预测到底走了哪条路径**
   - 同样叫 compact，实际可能是完全不同的流程。

3. **依赖 feature flag / env 很多**
   - 好处是灵活，坏处是理解成本和调试成本都高。

4. **更像产品工程，不像通用框架**
   - 如果只是想做一个干净的 agent runtime，直接照搬会过重。

#### 适合怎么借鉴
- 适合借鉴它的 **layered fallback + post-compact runtime restoration**。

---

## 四、把三者放在一张表里

| 维度 | deepseek-harness | pi | tclaude-code-sourcemap |
|---|---|---|---|
| 核心风格 | 框架内核型 | transcript 折叠型 | 产品运行态恢复型 |
| 自动触发时机 | pre-step + request-error | assistant response 后 | 请求前阈值判断，分层 fallback |
| compact 落地方式 | 原位修改 surface | 追加 `CompactionEntry` | boundary + summary + 附件恢复 / 或 API 清理 |
| threshold 风格 | 比例型 | 固定预留型 | 双层预留 + 多路径 |
| overflow 恢复 | 强 | 有 | 有，但路径更复杂 |
| cache 复用意识 | 强 | 弱一些 | 强，但受路径影响 |
| 产品运行态恢复 | 弱 | 中 | 强 |
| 复杂度 | 中高 | 中 | 很高 |
| 最适合场景 | 通用 agent framework | 可审计 session 系统 | CLI / IDE / coding agent 产品 |

---

## 五、一个可直接拿去写文章的观点

如果把 compact 看成一个系统设计题，而不是一个 prompt 技巧题，那这三家其实代表了 3 种工程哲学：

- **deepseek-harness** 在回答：
  “怎么把 compact 做成 runtime 内核的一部分？”

- **pi** 在回答：
  “怎么把 compact 做成 transcript / session 数据结构的一部分？”

- **tclaude-code-sourcemap** 在回答：
  “怎么把 compact 做成产品级上下文管理系统的一部分？”

这个角度可能比单纯比较“谁什么时候压缩、谁保留多少 token”更有意思。

---

## 六、后续可展开的写作方向（先记材料）

### 方向 A：写成“3 种 compact 哲学”
适合面向更泛的 agent / coding agent 读者。

可写结构：
1. 为什么 compact 不是一个 prompt 小技巧，而是系统架构问题
2. deepseek：事务式 compact
3. pi：日志折叠式 compact
4. tclaude：产品运行态式 compact
5. 你要自己实现 compact，应该借哪一层

### 方向 B：写成“如果我自己设计第 4 种 compact，会怎么融合三家优点”
可主打实战感。

一个可行的融合方向：
- 先用 **tclaude 的 layered fallback**
- 核心状态变更用 **deepseek 的 transaction 思路**
- 持久化表示用 **pi 的 compaction entry**

### 方向 C：写成“为什么很多人把 compact 想简单了”
适合做观点文。

可以打的点：
- 不是“快满了让模型总结一下”就完了
- 你要处理 tool pair、thinking、图片、附件、plan、session memory
- 真正难的是 **压缩之后还能不能无缝继续工作**

---

## 七、我自己的当前结论（草稿口吻）

如果只问“哪个最优雅”，我会偏向 **deepseek-harness**，因为它最像一个干净的 runtime 内核设计。

如果只问“哪个最好懂”，我会偏向 **pi**，因为它的心智模型最稳定：旧历史不删，记一条 compaction entry，之后按 entry rebuild。

如果只问“哪个最能打线上真实复杂场景”，我会偏向 **tclaude-code-sourcemap**，因为它已经不是一个单点 compact 实现，而是一整套上下文管理策略栈。

换句话说：
- **deepseek** 赢在架构边界
- **pi** 赢在数据模型清晰
- **tclaude** 赢在产品工程完整度

---

## 八、可留作以后润色的标题备选

- 三种 compact，不只是三种“摘要策略”
- deepseek、pi、tclaude：三套 agent compact 哲学
- 为什么 compact 真正难的不是“总结”，而是“继续工作”
- 从 3 个项目看，compact 到底应该长成 runtime、log，还是产品系统？
- Agent 的 compact 不是 prompt 技巧，而是架构问题
