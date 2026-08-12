---
title: QA Sensory Chat Template
description: Reusable template for topic-based English practice — Q&A dialogue that trains emotional, chatty thinking (not binary yes/no)
date: 2026-08-11
tags: [template, qa, conversation, sensory-thinking, small-talk]
---

# QA Sensory Chat Template

> **Who this is for:** You pick a topic → introduce it → practice in **Q / A** form.  
> **Core problem this fixes:** Answers that sound like code — `true` / `false`, efficient, empty of life.  
> **What we train:** **感性思维链路** (sensory → scene → feeling → soft opinion → open door).

---

## 0. The problem (programmer brain)

| Situation | Programmer answer | Real chat needs |
|---|---|---|
| Do you like sports? | Yes. / No. | A little story + a feeling |
| What did you do this weekend? | I worked. | One scene the other person can picture |
| How was the meeting? | Fine. | One texture: tense / boring / funny |

You're not wrong. You're just **too complete and too short** — like a function return value.

Daily chat is not a unit test. It's **sharing a tiny movie**.

---

## 1. The sensory thinking chain (always use this)

When a question hits you, **don't answer true/false first**. Walk this path:

```text
Q arrives
  │
  ├─ ① Feel first        What does my body / mood say? (warm / heavy / light / bored / excited)
  ├─ ② Flash a scene     When · where · who · what was I doing?
  ├─ ③ One detail only   Color / sound / weather / a small moment (not a full report)
  ├─ ④ Soft stance       kind of / depends / lately / not really / more than I expected
  └─ ⑤ Open the door     Ask back · invite them in · leave a hook
```

### Mini formula (memorize this)

> **Soft answer + scene crumb + feeling word + door**

Example on *Do you like sports?*

| Layer | Example |
|---|---|
| Soft answer | Kind of… not in a hardcore way. |
| Scene crumb | On weekends I sometimes play badminton with friends. |
| Feeling word | After that I feel lighter, like my brain finally shut up. |
| Door | What about you — more team sports or solo stuff? |

Full spoken version:

> "Kind of… not in a hardcore way. On weekends I sometimes play badminton with friends, and after that I feel lighter — like my brain finally shut up. What about you — more team sports or solo stuff?"

---

## 2. Forbidden defaults (replace these)

| ❌ Default (code style) | ✅ Chatty upgrade |
|---|---|
| Yes. | Kind of — depends on the day. |
| No. | Not really… unless it's something chill. |
| Because A, B, C. | One tiny reason + one scene. |
| I don't know. | I'm not sure yet — last time I tried… |
| It's okay / fine. | It was okay, a bit quiet / a bit intense. |
| Silence after answer | Always add a door: "You?" / "Have you…?" |

### Soft stance words (keep these ready)

- kind of / sort of  
- not really / not that much  
- it depends  
- lately / these days  
- more than I expected  
- less than I used to  
- when I'm in the mood  
- only if…

### Feeling / body words (感性 vocabulary bank)

| Light / good | Heavy / low | Mixed / real |
|---|---|---|
| lighter, fresher, awake | drained, heavy, foggy | conflicted, bittersweet |
| warm, cozy, calm | tight, restless, numb | weirdly peaceful |
| buzzing, alive | flat, empty | "I don't hate it" |

Use **body language of the mind**: *my brain shut up*, *my shoulders drop*, *I feel less stuck*.

---

## 3. Article skeleton (copy for every new topic)

Copy everything below into a new file: `articles/<topic-slug>.md`

```markdown
---
title: <Topic in English>
description: QA dialogue practice — sensory chat chain on <topic>
date: YYYY-MM-DD
tags: [qa, conversation, <topic-tag>]
---

# <Topic Title>

## Why this topic (1 short paragraph)

<Why you care / why people talk about this / your honest relationship with it — 3–5 sentences. Not a definition. A feeling.>

---

## The thinking chain for this topic

| Step | My fill-in |
|---|---|
| ① Feel first | … |
| ② Scene | … |
| ③ One detail | … |
| ④ Soft stance | … |
| ⑤ Door | … |

---

## Dialogue (QA × 4–6 turns)

### Q1 — entry question
**A (programmer default):**  
> …

**A (sensory chat):**  
> …

**Chain used:** feel → scene → soft → door

---

### Q2 — go one layer deeper
**A (programmer default):**  
> …

**A (sensory chat):**  
> …

---

### Q3 — opinion / preference
…

### Q4 — story / memory
…

### Q5 — invite the other person
…

---

## Reusable sentence shells for this topic

1. "Kind of… especially when ___."
2. "I'm not crazy about it, but ___ makes it different."
3. "Lately I've been ___, and it feels ___."
4. "There was this one time when ___ — I still remember ___."
5. "What about you? Do you ___ or ___?"

---

## My own answers (blank practice)

| Q | My first draft (honest, messy) | Polished sensory version |
|---|---|---|
| Q1 | | |
| Q2 | | |
| Q3 | | |

---

## Words & phrases I stole from this dialogue

| Phrase | When to use |
|---|---|
| | |
```

---

## 4. How to write one article (5 minutes)

1. **Pick a topic** people actually chat about (sports, weekend, coffee, sleep, AI tools, hometown, movies…).
2. **Write 1 short intro** — your real relationship with it, not Wikipedia.
3. **List 4–6 questions** a friend would ask (not exam questions).
4. For each Q: write the **programmer answer** first (shame-free), then rebuild with the chain.
5. **Fill "My own answers"** without looking at the polished version.

Rule of thumb: if your answer has **zero scene and zero feeling**, rewrite.

---

## 5. Question types that force 感性 (use these)

| Type | Example | Why it works |
|---|---|---|
| Preference | Do you like…? | Needs soft stance, not binary |
| Scene | When was the last time you…? | Forces memory + detail |
| Feeling | How do you feel after…? | Blocks pure logic |
| Contrast | Alone or with people? | Preference with texture |
| Story | Tell me about one time… | Narrative muscle |
| Door | What about you? | Two-way chat |

Avoid: "Define X" / "List advantages of X" — that's essay mode, not chat.

---

## 6. Self-check after each answer

- [ ] Did I avoid bare Yes / No / Fine?
- [ ] Is there **one** picture the other person can see?
- [ ] Is there **one** feeling or body word?
- [ ] Did I leave a **door** (question / invitation)?
- [ ] Would a friend want to reply — or is the thread dead?

If 3+ boxes fail → rebuild with the chain.

---

## 7. Example files in this folder

| File | What it shows |
|---|---|
| `_template-qa-sensory-chat.md` | This template |
| `example-do-you-like-sports.md` | Full worked example (sports / movement) |

When you start a new topic, **copy section 3**, fill it, save as `articles/<topic>.md`.
