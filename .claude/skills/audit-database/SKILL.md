---
name: audit-database
description: Audit database schema, queries, indexes, migrations, and transaction safety.
---

# Database Audit

## Steps

1. Read drizzle.config.ts and all files in src/lib/db/
2. Check schema for missing indexes on frequently-queried columns
3. Look for N+1 query patterns (multiple sequential queries that could be JOINed)
4. Check for schema drift (schema.ts vs migrations mismatch)
5. Look for missing transaction wrappers on multi-step operations
6. Check for database queries outside the service layer
7. Verify foreign key constraints and cascade behavior
8. Look for inconsistent naming conventions
9. Check for missing validation constraints at DB level
10. Review migration files for duplicate or conflicting changes

## Severity Guide

- **CRITICAL**: Schema drift, missing transactions, data consistency risks
- **HIGH**: Missing indexes on hot paths, N+1 patterns
- **MEDIUM**: Queries outside service layer, missing constraints
- **LOW**: Naming inconsistencies, minor optimizations
