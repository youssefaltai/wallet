---
name: audit-components
description: Audit React components for quality, duplication, accessibility, and separation of concerns.
---

# Component Quality Audit

## Steps

1. Read all component files in src/components/
2. Look for components >200 lines that should be split
3. Check for prop drilling that could be simplified
4. Look for duplicated logic across components (copy-pasted patterns)
5. Check for components that mix data fetching with rendering
6. Look for missing or incorrect TypeScript types (unsafe casts, missing generics)
7. Check for hardcoded strings that should be constants
8. Check for accessibility issues (missing aria-labels, missing alt text)
9. Look for missing error/loading states in data-fetching components
10. Check for near-duplicate components that could be parameterized

## Severity Guide

- **CRITICAL**: Mixed concerns, missing error handling, accessibility violations
- **HIGH**: Type safety issues, large components, code duplication
- **MEDIUM**: Hardcoded strings, inconsistent patterns
- **LOW**: Minor improvements
