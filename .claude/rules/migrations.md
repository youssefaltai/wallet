---
paths:
  - "src/lib/db/**"
  - "src/lib/db/migrations/**"
---

# Database Migration Rules

Rules for creating, reviewing, and applying schema changes.

## The Workflow

Always use `pnpm db:generate` to create migrations. Never write migration SQL by hand.

```
1. Edit src/lib/db/schema.ts
2. pnpm db:generate           → creates a new .sql file
3. Review the generated SQL   → check for correctness
4. pnpm db:migrate            → apply to the database
5. pnpm tsc --noEmit          → verify schema types still compile
```

If `pnpm db:generate` creates something unexpected, fix `schema.ts` and regenerate. Don't patch the SQL file.

## Migration Numbering

Migration files are numbered sequentially: `0001_`, `0002_`, etc. The sequence is tracked in `src/lib/db/migrations/meta/_journal.json`.

- Never create two files with the same number prefix
- Never manually edit `_journal.json` — let `pnpm db:generate` manage it; the only exception is a deliberate migration squash (which requires editing both the journal and snapshots together atomically)
- If there's a numbering conflict (two files with the same prefix), delete the newer one, fix `schema.ts`, and run `pnpm db:generate` again

## SQL Review Checklist

Before applying a generated migration, verify:

- [ ] No unintended `DROP COLUMN` or `DROP TABLE` — data loss is permanent
- [ ] All new `NOT NULL` columns have a `DEFAULT` value (or the table is empty)
- [ ] New FK columns have a corresponding index (performance on JOINs and FK checks)
- [ ] No `ALTER COLUMN` that changes type in a way that loses precision (e.g., varchar → smaller varchar)
- [ ] New indexes are named descriptively and don't duplicate existing ones
- [ ] `ON DELETE CASCADE` vs `ON DELETE RESTRICT` is intentional

## Schema Conventions

- All tables have `createdAt timestamp with time zone DEFAULT now()` and `updatedAt timestamp with time zone` (use `$onUpdateFn(() => new Date())`)
- Financial tables with historical records also have `deletedAt timestamp with time zone` (soft-delete pattern)
- Primary keys are text UUIDs (`text().primaryKey().$defaultFn(() => crypto.randomUUID())`)
- Foreign keys always reference the primary key of the parent table
- All FKs on heavily-queried columns should have an index

## Adding Constraints

When adding a new constraint (CHECK, UNIQUE, FK) to an existing table with data, the migration must verify the existing data satisfies the constraint or backfill it first.

Drizzle won't automatically add this backfill — if adding a NOT NULL constraint to an existing column with nulls, you need to handle it manually.

## After Applying

After `pnpm db:migrate`:
1. Run `pnpm tsc --noEmit` — schema types should still compile
2. Update any affected services, AI tools, or API routes that reference changed columns
3. If the migration changes financial data structure, verify `ledger.ts` still works correctly
