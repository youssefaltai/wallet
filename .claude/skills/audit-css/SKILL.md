---
name: audit-css
description: Audit CSS and styling for hardcoded colors, unused styles, dark mode gaps, and inconsistent patterns.
---

# CSS & Styling Audit

## Steps

1. Read globals.css — analyze for unused styles, redundant rules, verbose CSS
2. Check Tailwind configuration (postcss config, tailwind config)
3. Grep for inline styles (`style={{`) that should be Tailwind classes
4. Grep for hardcoded color values (text-red-600, bg-green-500, etc.) that should use design tokens
5. Check for conflicting or overriding styles
6. Look for inconsistent dark mode support (some components with dark: variants, others without)
7. Check for CSS-in-JS mixed with Tailwind
8. Check for semantic color tokens defined but not used

## Severity Guide

- **HIGH**: Hardcoded values that should use tokens, missing dark mode
- **MEDIUM**: Inconsistent patterns, redundant styles
- **LOW**: Minor optimizations, unused CSS

Include file:line references for every finding.
