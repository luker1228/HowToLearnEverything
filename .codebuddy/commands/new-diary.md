# New Diary Entry

Creates a new blank diary file in `diaries/` with the current date as the filename.

## Usage
```
/new-diary
```

## Action

1. Get current date in format `YYYY-MM-DD`
2. Create file at `diaries/<date>.md`
3. Initialize with basic diary template:

```markdown
# <current date>

## Today

```

## Notes

- The filename will be in the format: `2026-04-06.md`
- Place the file in the `diaries/` directory
