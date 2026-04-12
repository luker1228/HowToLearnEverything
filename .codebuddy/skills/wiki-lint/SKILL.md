---
name: wiki-lint
description: >
  Run a health check on the English learning wiki to find issues and suggest improvements.
  This skill scans all wiki pages for contradictions, orphan pages, missing cross-references,
  stale content, duplicate entries, and gaps in coverage. It also suggests new topics to explore
  and sources to find. Use this skill when the user says "lint the wiki", "check wiki health",
  "review my wiki", "is my wiki in good shape", "what should I learn next", "find problems in the wiki",
  or periodically after several ingestion cycles to keep the knowledge base healthy and growing.
  Also use it when the user seems unsure what to study next or wants a learning roadmap based
  on their accumulated error patterns.
---

# Wiki Lint

Perform a health check on the English learning wiki and suggest improvements.

## Context

This repository is a personal English learning wiki. Over time, as diary entries and other sources are ingested, the wiki accumulates vocabulary, error patterns, writing techniques, and summaries. This lint operation ensures the wiki stays healthy, consistent, and useful as it grows. Read `CODEBUDDY.md` for the full structure.

## Workflow

### 1. Scan all wiki pages

Read every file in the `wiki/` directory tree. Build a mental map of:
- All pages and their content
- All cross-references (links between pages)
- All entries in `index.md`
- All entries in `log.md`
- All files in `sources/` (to check for unprocessed sources)

### 2. Check for issues

Run these checks and collect findings:

**Structural issues:**
- Orphan pages: files in `wiki/` not listed in `index.md`
- Missing pages: entries in `index.md` that link to non-existent files
- Broken links: any `[text](path)` links pointing to missing files
- Empty pages: wiki pages with headers but no actual content

**Content issues:**
- Duplicate vocabulary: same word appearing multiple times in `words.md`
- Duplicate phrases: same phrase in `phrases.md`
- Contradictions: conflicting advice or rules across different pages
- Stale frequency notes: error patterns marked "first occurrence" that have actually appeared multiple times

**Completeness issues:**
- Unprocessed sources: files in `sources/` with no corresponding entry in `log.md`
- Missing summaries: ingested sources without summary pages in `wiki/summaries/`
- Thin pages: wiki pages with very few entries that could be enriched
- Missing cross-references: error patterns that relate to vocabulary or techniques without links

**Learning insights:**
- Most common error categories (which grammar mistakes keep recurring?)
- Vocabulary growth rate (how many words added per source?)
- Writing improvement signals (are certain error types becoming less frequent?)
- Suggested next areas to focus on based on weakness patterns

### 3. Report findings

Present the report in English, organized by severity:

```markdown
## Wiki Health Report — <date>

### Issues Found

#### Critical (should fix now)
- ...

#### Moderate (fix when convenient)
- ...

#### Minor (nice to have)
- ...

### Learning Insights
- Most common error type: ...
- Vocabulary count: ... words, ... phrases, ... expressions
- Sources ingested: ...
- ...

### Suggestions
- Topics to explore next: ...
- Recommended sources to find: ...
- Wiki pages that need enrichment: ...
```

### 4. Offer to fix issues

For structural issues (orphan pages, missing index entries, broken links, duplicates), offer to fix them automatically. Ask before making changes.

For content suggestions (new topics, enrichment), describe what would be helpful and let the user decide.

### 5. Log the lint

Append to `wiki/log.md`:

```markdown
## [<date>] lint | Wiki health check

- Pages scanned: <N>
- Issues found: <N critical>, <N moderate>, <N minor>
- Fixes applied: <list, if any>
- Suggestions: <brief list>
```

## Important Notes

- All output in English (immersive learning)
- Read every wiki file — don't skip any
- Be encouraging about progress, not just critical about issues
- The learning insights section is the most valuable part — help the user understand their patterns
- Suggest concrete next steps, not vague advice
