# Formatter Cases

The test runner loads every `case-*.md` file recursively under this directory.

Keep fixture files broad and behavior-focused instead of creating one file per small scenario.

## Files

- `case-standard-markdown.md`: Markdown and Obsidian syntax that should stay unchanged.
- `case-formatting-rules.md`: Formatting that this plugin explicitly supports, including shorthand syntax and list item trailing spaces.

Regression coverage should usually be added to one of these files based on the behavior it protects.

When adding a case, keep the `## 输入` and `## 预期输出` headings unchanged.
