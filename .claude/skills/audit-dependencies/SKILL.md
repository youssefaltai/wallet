---
name: audit-dependencies
description: Analyze the codebase for unused, redundant, or miscategorized package dependencies.
---

# Dependency Audit

## Steps

1. Read `package.json` to get all dependencies and devDependencies
2. For each dependency, grep `src/` for actual imports
3. Check for duplicate functionality (e.g., two CSS libraries, two form libraries)
4. Check for dependencies that should be in devDependencies (only used in config/scripts)
5. Check for missing dependencies (imported but not listed)

## Report Sections

- **UNUSED**: Dependencies listed but never imported in src/
- **REDUNDANT**: Dependencies that overlap in functionality
- **MISCATEGORIZED**: Runtime deps that should be devDeps or vice versa
- **MISSING**: Imports that reference uninstalled packages
- **CLEAN**: Confirm which dependencies are properly used

Check every single dependency. Include file paths as evidence.
