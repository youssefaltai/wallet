---
name: audit-dead-files
description: Find dead, unused, or orphaned files in the codebase.
---

# Dead File Audit

## Steps

1. Glob all .ts/.tsx/.js/.jsx files in src/
2. For each file that exports something, grep to see if those exports are imported anywhere
3. Look for orphaned components not imported by any page or other component
4. Check for empty files or stub files with no real content
5. Look for duplicate files or files with very similar content
6. Check for leftover dev artifacts (.png screenshots, temp files, etc.)

## Report Format

For each finding include:
- **File path**
- **Status**: DEAD (confirmed unused) / SUSPECT (likely unused) / ARTIFACT (dev leftover)
- **Evidence**: What you grepped and what you found (or didn't find)
- **Recommendation**: Delete / Investigate / Keep

Verify each file by checking all possible import patterns (named, default, re-export, dynamic).
