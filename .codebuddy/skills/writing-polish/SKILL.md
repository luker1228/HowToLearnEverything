---
name: writing-polish
description: IELTS写作导师技能。使用《The Elements of Style》的写作原则，基于用户的文章提供详细反馈、修改建议和参考范文。当你想要改进雅思作文、练习写作、获取写作反馈、请求参考范文、或分析范文时使用此技能。
---

# IELTS Writing Tutor

## Overview

Based on **The Elements of Style** (Strunk & White) principles, this skill helps you improve your IELTS writing through:
1. Detailed analysis of your essay
2. Specific suggestions for improvement
3. A sample essay on the same topic

For a complete working example, see [template.md](template.md).

---

## Workflow

### Step 1: Read the Essay

Read the file at the provided path. If no path is provided, ask the user to specify the file path.

### Step 2: Analyze Against The Elements of Style Principles

Evaluate the essay against these key principles:

| # | Principle | Key Question |
|---|-----------|--------------|
| 1 | Make the paragraph the unit of composition | Does each paragraph have one central idea? |
| 2 | Use active voice | Are there passive voice constructions? |
| 3 | Put statements in positive form | Any negative constructions that could be positive? |
| 4 | Use definite, specific, concrete language | Any vague words like "things", "stuff", "very", "really"? |
| 5 | Omit needless words | Any wordiness or redundancy? |
| 6 | Avoid superfluous sentences | Any sentences that don't advance the argument? |
| 7 | Use parallel structure | Do items in series match grammatically? |
| 8 | Keep related words together | Any misplaced modifiers? |
| 9 | Use transitional expressions sparingly | Overusing "however", "moreover"? |
| 10 | Put the emphatic word at the end | Does the sentence end with the most important word? |

### Step 3: IELTS-Specific Evaluation

| Criterion | What to Check |
|-----------|---------------|
| Task Achievement | Addresses all parts? Clear position? Evidence to support? |
| Coherence & Cohesion | Logical organization? Natural cohesion? Appropriate paragraphing? |
| Lexical Resource | Varied vocabulary? Accurate word forms? Natural collocations? |
| Grammatical Range | Varied sentence structures? Any grammatical errors? |

### Step 4: Provide Structured Feedback

Output feedback in this format:

```
## Original Essay Analysis

**File:** [filename]

### Issues Found

#### Critical Issues
| Location | Issue | Suggestion |
|----------|-------|------------|
| Para X | "original text" | "suggested fix" |

#### Moderate Issues
| Location | Issue | Suggestion |
|----------|-------|------------|
| Para X | "original text" | "suggested fix" |

#### Minor Issues
| Location | Issue | Suggestion |
|----------|-------|------------|
| Para X | "original text" | "suggested fix" |

### Elements of Style Evaluation

| Rule | Status | Comments |
|------|--------|----------|
| 1. Paragraph as unit | ✓/⚠️/❌ | Comment |
| ... | ... | ... |

### IELTS Band Score Assessment

| Criterion | Score | Comments |
|-----------|-------|----------|
| Task Achievement | X | comment |
| Coherence & Cohesion | X | comment |
| Lexical Resource | X | comment |
| Grammatical Range | X | comment |

### Overall Suggestions

1. [Top priority improvement]
2. [Second priority]
3. [Third priority]

---

## Improved Version

[Provide the polished essay with tracked changes in a table: Original | Improved | Reason]

---

## Sample Essay

**Topic:** [same or similar topic]

[Well-written model essay of appropriate length]

### What Makes This Essay Effective

[Key techniques demonstrated with examples]

### Vocabulary Highlights

| Original | Improved | Why Better |
|----------|----------|------------|
| ... | ... | ... |

---

## Reference Files

For detailed principles and examples:
- [references/elements-of-style.md](references/elements-of-style.md)
- [references/ielts-criteria.md](references/ielts-criteria.md)
- [references/common-issues.md](references/common-issues.md)
- [template.md](template.md) - Complete working example

---

## Important Notes

1. **Be constructive but honest** - Focus on most impactful improvements
2. **Be specific and actionable** - Show exact fixes, not vague suggestions
3. **All output in English** - Never mix Chinese or other languages
4. **Match sample essay type** - Task 1 vs Task 2
5. **Prioritize clarity** - Don't suggest alternatives equally awkward as original

## Common Critical Issues to Always Flag

- Subject-verb agreement errors
- Parallel structure errors in verb lists
- Incorrect comparative forms ("The more...the more...")
- Missing articles where required
- Typos that change meaning
- Overused intensifiers (very, really, so)

