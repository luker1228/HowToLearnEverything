# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with this repository.

## Project Overview

This is a personal English learning knowledge base following the [LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). It has three layers:

1. **Raw Sources** (`sources/`) — Original materials (diaries, articles, podcasts, etc.). Immutable. AI reads but never modifies.
2. **The Wiki** (`wiki/`) — AI-maintained knowledge pages. User reads, AI writes and maintains.
3. **This Schema** (`CODEBUDDY.md`) — Instructions for how AI should maintain the wiki.

## Repository Structure

```
sources/
  diaries/          # Original diary entries by date
  articles/         # Web articles, reading notes
  podcasts/         # Podcast/video notes
  other/            # Any other learning material

wiki/
  index.md          # Master catalog of all wiki pages
  log.md            # Chronological record of all operations
  vocabulary/
    words.md        # Accumulated vocabulary with examples
    phrases.md      # Useful phrases and collocations
    expressions.md  # Natural expressions from corrections
  errors/
    grammar.md      # Recurring grammar mistakes
    word-choice.md  # Word choice issues and alternatives
    structure.md    # Sentence/paragraph structure patterns
  writing/
    techniques.md   # Writing tips and principles
    comparisons.md  # Original vs improved side-by-side
    style-guide.md  # Personal style notes and goals
  summaries/        # One summary per ingested source
```

## Commands

This is a content repository, not a software project:
- No build, lint, or test commands apply
- Version control via standard git commands

## Wiki Operations

### Ingest (when a new source is added)

1. Read the source material in `sources/`
2. Create a summary page in `wiki/summaries/`
3. Extract new vocabulary → append to `wiki/vocabulary/words.md`, `phrases.md`, `expressions.md`
4. Identify error patterns → append to `wiki/errors/grammar.md`, `word-choice.md`, `structure.md`
5. Note writing techniques → append to `wiki/writing/techniques.md`, `comparisons.md`
6. Update `wiki/index.md` with new pages
7. Append operation to `wiki/log.md`

Typically an ingest touches 5-10 wiki pages.

### Query (when user asks a question)

1. Read `wiki/index.md` to find relevant pages
2. Read those pages and synthesize an answer
3. If the answer becomes a useful reference, file it as a new wiki page

### Lint (periodic health check)

1. Check for contradictions across pages
2. Find orphan pages not linked from index
3. Identify stale claims or missing cross-references
4. Suggest new topics to explore or sources to find

## Design Principles

- **All wiki content in English** (immersive learning)
- Keep original sources authentic and unmodified
- AI improvements preserve the original meaning while making expressions more natural
- Focus on practical, conversational English rather than formal writing
- Wiki pages grow incrementally — start minimal, accumulate through ingestion
- Track error patterns to help identify recurring mistakes
- Use tables for structured data (vocabulary, error patterns, comparisons)
