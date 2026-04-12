---
name: wiki-ingest
description: >
  Ingest a new source (diary entry, article, podcast notes, or any learning material) into the English learning wiki.
  This skill reads raw source files, extracts vocabulary, identifies grammar/error patterns, notes writing techniques,
  creates a summary page, and updates the wiki index and log. Use this skill whenever the user adds new content to
  sources/ and wants to process it, says things like "ingest this", "process my new diary", "I added a new article",
  "help me learn from this", or drops a new file into the sources directory. Also use it when the user writes a new
  diary entry and wants feedback and wiki integration. Even if they just say "I wrote something new" or
  "check my latest diary", this is the right skill.
---

# Wiki Ingest

Process new learning materials into the English learning wiki knowledge base.

## Context

This repository is a personal English learning wiki following the LLM Wiki pattern. The structure is:

- `sources/` — Raw, immutable source materials (diaries, articles, podcasts, other)
- `wiki/` — AI-maintained knowledge pages that grow over time
- `CODEBUDDY.md` — Schema describing the wiki structure and conventions

Read `CODEBUDDY.md` first to understand the full repository structure and conventions.

## Workflow

### 1. Identify the source

Determine what needs to be ingested. Check `sources/` subdirectories for new or unprocessed files.
If the user hasn't specified which file, check `wiki/log.md` to see what's already been ingested, then look for files in `sources/` that don't have corresponding entries in the log.

If the source is a diary entry and there's no feedback file yet, generate detailed feedback first (grammar corrections, vocabulary suggestions, improved version) and save it alongside the original as `<date>-feedback.md`.

### 2. Read and analyze the source

Read the source material thoroughly. For diary entries, also read the feedback file. Identify:

- **New vocabulary**: Words the user likely doesn't know well, or words from the improved version that replace simpler alternatives
- **Phrases & collocations**: Multi-word expressions, idioms, natural English phrasings
- **Natural expressions**: Before/after pairs showing how awkward phrasing becomes natural English
- **Grammar errors**: Categorize by type (subject-verb agreement, articles, tense, etc.)
- **Word choice issues**: Vague words, overused intensifiers, better alternatives
- **Structure problems**: Paragraph organization, wordiness, positive vs negative form
- **Writing techniques**: Principles demonstrated in the corrections

### 3. Update wiki pages (typically 5-10 pages)

Append new entries to existing wiki pages. Never overwrite existing content — always append.

**Vocabulary pages** (`wiki/vocabulary/`):
- `words.md` — Add new words in the existing table format: `| word | meaning | example sentence | source |`
- `phrases.md` — Add phrases: `| phrase | meaning | example | source |`
- `expressions.md` — Add expression pairs: `| instead of... | say... | why it's better |`

Check for duplicates before adding. If a word/phrase already exists, skip it or update the example if the new one is better.

**Error pages** (`wiki/errors/`):
- `grammar.md` — Add errors under existing category headers, or create new category sections. Format: table with Error/Correction/Rule columns, plus Frequency note.
- `word-choice.md` — Add to existing sections or create new ones.
- `structure.md` — Add new structural patterns.

If an error pattern already exists, increment its frequency note rather than duplicating it.

**Writing pages** (`wiki/writing/`):
- `techniques.md` — Add new principles or examples under existing headers.
- `comparisons.md` — Add new full-text comparison sections for each source.
- `style-guide.md` — Update progress markers if relevant, adjust current level assessment if there's clear improvement.

### 4. Create a summary page

Create `wiki/summaries/<descriptive-name>.md` with this structure:

```markdown
# Summary: <Title>

**Source:** [link to source file]
**Date ingested:** <today's date>

---

## Topic
One-line description of what the source is about.

## Key Ideas
Numbered list of main points.

## Vocabulary Extracted
Comma-separated list of words added to the wiki.

## Phrases Learned
Comma-separated list of phrases added.

## Error Patterns Found
Bullet list of error types identified.

## Writing Lessons
Bullet list of techniques noted.
```

### 5. Update index and log

**`wiki/index.md`**: Add the new summary page link under "Source Summaries" section.

**`wiki/log.md`**: Append a new entry at the bottom:

```markdown
## [<date>] ingest | <Source Title>

- Source: `<path to source file>`
- Summary page created: `summaries/<name>.md`
- Vocabulary extracted: <N> word/phrase entries
- Error patterns logged: <counts by category>
- Writing techniques noted: <N> principles
```

### 6. Report to the user

After ingestion, give the user a brief summary in English:
- What was ingested
- Key vocabulary and phrases worth reviewing
- Most important error patterns found (especially recurring ones)
- Any notable improvement compared to previous entries

Keep it conversational and encouraging — this is a learning tool, not a grading system.

## Important Notes

- All wiki content must be in English (immersive learning)
- Never modify files in `sources/` — they are immutable raw materials
- Always append to existing wiki pages, never overwrite
- Check for duplicates before adding vocabulary or error patterns
- Use the exact table formats that already exist in each wiki page
- If a diary has no feedback file, generate one before ingesting
