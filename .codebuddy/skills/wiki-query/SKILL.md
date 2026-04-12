---
name: wiki-query
description: >
  Answer questions about English learning by searching the personal wiki knowledge base.
  This skill reads the wiki index to find relevant pages, synthesizes answers with examples from
  the user's own writing history, and optionally saves useful answers back as new wiki pages.
  Use this skill whenever the user asks English language questions like "how do I use X",
  "what's the difference between X and Y", "what mistakes do I keep making", "show me my vocabulary",
  "what did I learn from my last diary", "what grammar rules should I review", or any question that
  could be answered by searching their accumulated learning wiki. Also use it when they want to review
  their progress, look up something they learned before, or ask about English grammar, vocabulary,
  or writing techniques in the context of their own learning journey.
---

# Wiki Query

Answer questions by searching the English learning wiki knowledge base.

## Context

This repository is a personal English learning wiki. The `wiki/` directory contains accumulated knowledge from the user's diary entries and other learning materials, organized into vocabulary, error patterns, writing techniques, and source summaries. Read `CODEBUDDY.md` to understand the full structure.

## Workflow

### 1. Understand the question

Parse what the user is asking. Common query types:

- **Vocabulary lookup**: "What does X mean?", "How do I use X?"
- **Error review**: "What grammar mistakes do I keep making?", "Show me my common errors"
- **Progress check**: "What have I learned so far?", "How has my writing improved?"
- **Technique recall**: "What writing tips have I collected?", "How should I structure paragraphs?"
- **Comparison**: "What's the difference between X and Y?"
- **Source recall**: "What was my last diary about?", "What did I learn from article X?"

### 2. Search the wiki

Start by reading `wiki/index.md` to find relevant pages. Then read those pages to gather information.

**Search strategy by query type:**

| Query type | Pages to check |
|-----------|---------------|
| Vocabulary | `vocabulary/words.md`, `vocabulary/phrases.md`, `vocabulary/expressions.md` |
| Grammar/errors | `errors/grammar.md`, `errors/word-choice.md`, `errors/structure.md` |
| Writing tips | `writing/techniques.md`, `writing/comparisons.md`, `writing/style-guide.md` |
| Progress/review | `writing/style-guide.md` (progress markers), `log.md` (activity history) |
| Source recall | `summaries/` directory, then the specific summary page |
| General | Start with `index.md`, then follow relevant links |

### 3. Synthesize an answer

Compose the answer in English (immersive learning). Key principles:

- **Ground in the user's own examples.** When possible, reference their actual diary sentences rather than generic examples. This makes learning personal and memorable.
- **Be specific.** Don't just say "you make grammar errors" — quote the exact pattern from the wiki.
- **Connect ideas.** If a vocabulary word relates to an error pattern or a writing technique, mention the connection.
- **Keep it practical.** Focus on what the user can do differently, not abstract rules.

### 4. Optionally file back to wiki

If your answer produces something worth keeping (a new comparison table, a synthesized overview, a useful pattern), offer to save it as a new wiki page. The user's wiki should compound — good queries should make it richer.

If filing a new page:
1. Write it to the appropriate `wiki/` subdirectory
2. Add it to `wiki/index.md`
3. Append a query log entry to `wiki/log.md`:
   ```
   ## [<date>] query | <Brief question summary>
   
   - Question: "<the user's question>"
   - Pages consulted: <list>
   - New page created: <path, if any>
   ```

## Important Notes

- All responses in English (immersive learning)
- Always cite which wiki page the information came from
- If the wiki doesn't have enough information to answer, say so honestly and suggest what source material could fill the gap
- Never modify existing wiki content during a query — only add new pages if warranted
