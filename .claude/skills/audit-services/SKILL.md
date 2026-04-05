---
name: audit-services
description: Audit the service layer for consistency, error handling, and separation of concerns.
---

# Service Layer Audit

## Steps

1. Read all files in src/lib/services/
2. Check for consistent patterns (error handling, return types, naming)
3. Look for business logic in API routes or components that belongs in services
4. Check error handling patterns (custom types vs generic throws vs Result objects)
5. Look for duplicated logic across services (formatting, validation, lookups)
6. Check for proper separation of concerns
7. Look for missing return type annotations on public functions
8. Check for inconsistent input validation patterns
9. Look for missing transaction scoping on multi-step operations
10. Check TypeScript types on inputs and outputs

## Per-Service Report

- **Size**: Lines of code and function count
- **Concerns**: What responsibilities it handles
- **Issues**: Specific problems found

Cross-service summary: consistency, duplication, architecture.
