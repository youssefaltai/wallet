# Migration Squash Runbook

## What This Squash Did

PR #3 replaced 13 incremental migration files (journal idx 0–12, tags `0000_cool_daredevil`
through `0011_journal_entries_updated_at`) with a single baseline file:
`0000_smiling_blob.sql`.

The new file is the net DDL state of all 13 migrations applied in sequence. It produces an
identical database schema to running the original 13 files one by one. The `_journal.json`
now contains a single entry for `0000_smiling_blob`.

**No new schema changes were introduced.** This is a pure consolidation.

---

## Applying to a Fresh Database

Nothing special is required. Run migrations normally:

```bash
pnpm drizzle-kit migrate
```

Drizzle will apply `0000_smiling_blob` in one step and record it in `__drizzle_migrations`.

---

## Applying to an Existing Database (Production)

An existing database already has all 13 original migrations recorded in `__drizzle_migrations`.
Drizzle tracks applied migrations by tag. The old tags no longer exist in `_journal.json`, so
Drizzle would try to apply `0000_smiling_blob` again — which would fail because the tables
already exist.

**You must tell Drizzle that `0000_smiling_blob` is already applied.**

### Step-by-step

1. Do **not** run `pnpm drizzle-kit migrate` on an existing database without this surgery first.

2. Connect to the production database and run:

```sql
-- 1. Remove all 13 old migration records
DELETE FROM __drizzle_migrations
WHERE tag IN (
  '0000_cool_daredevil',
  '0001_flimsy_wallflower',
  '0002_cool_magma',
  '0004_closed_silver_fox',
  '0004_smooth_fixer',
  '0005_fix_category_currencies',
  '0005_cold_matthew_murdock',
  '0006_new_doorman',
  '0007_sticky_ricochet',
  '0008_soft_delete_journal_entries',
  '0009_journal_zero_sum_trigger',
  '0010_add_missing_indexes',
  '0011_journal_entries_updated_at'
);

-- 2. Insert the squashed baseline as already-applied
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('0000_smiling_blob', extract(epoch from now()) * 1000);
```

> The `hash` column stores the migration tag. The `created_at` value is epoch milliseconds.
> Adjust the column names if your Drizzle version uses different names — inspect the table
> first with `\d __drizzle_migrations`.

3. Verify the table now contains exactly one row for `0000_smiling_blob`.

4. Deploy the new code. Running `pnpm drizzle-kit migrate` will now be a no-op (no pending
   migrations), which is correct.

---

## DML Gap — Currency Backfill

The squashed migration contains only DDL (schema). One of the original migrations,
`0005_fix_category_currencies.sql`, contained **DML** (a data fix):

```sql
UPDATE accounts
SET currency = u.currency
FROM users u
WHERE accounts.user_id = u.id
  AND accounts.type IN ('expense', 'income')
  AND accounts.currency = 'USD'
  AND u.currency != 'USD';
```

**What it fixed:** When the `currency` column was first added to `accounts` it defaulted to
`'USD'`. For users whose base currency was not USD, their auto-created expense and income
category accounts were incorrectly left as `'USD'` instead of inheriting the user's currency.
This one-time fix corrected those rows.

**Why it is not in the squashed migration:** SQL squashes consolidate DDL only. Re-running
this UPDATE on a fresh database is harmless (there are no existing rows to fix), but it is
also unnecessary — new accounts are now created with the correct currency from the start
because the application code was fixed at the same time.

**If you are restoring from a pre-fix backup** (taken before `0005_fix_category_currencies`
was applied), you must run the remediation query manually after restoring:

```sql
-- Remediation: fix category account currencies for non-USD users
-- Safe to run multiple times (idempotent).
UPDATE accounts
SET currency = u.currency
FROM users u
WHERE accounts.user_id = u.id
  AND accounts.type IN ('expense', 'income')
  AND accounts.currency = 'USD'
  AND u.currency != 'USD';
```

Run this query, then verify the results:

```sql
-- Should return 0 rows after the fix
SELECT a.id, a.name, a.currency AS account_currency, u.currency AS user_currency
FROM accounts a
JOIN users u ON a.user_id = u.id
WHERE a.type IN ('expense', 'income')
  AND a.currency = 'USD'
  AND u.currency != 'USD';
```

---

## Zero-Sum Trigger

`0000_smiling_blob.sql` includes the `check_journal_zero_sum()` function and the
`journal_lines_zero_sum` constraint trigger. These are part of the database-layer enforcement
of the double-entry invariant (every journal entry's lines must sum to zero).

On an existing database these already exist (created by `0009_journal_zero_sum_trigger`).
The `CREATE OR REPLACE FUNCTION` and `CREATE CONSTRAINT TRIGGER` statements will no-op or
update in place. If PostgreSQL complains that the trigger already exists, you can safely skip
that statement — the existing trigger is identical.

---

## Future Squashes

If you need to squash again in future:

1. Collect all current migration tags from `_journal.json`.
2. Generate the new baseline SQL by running `pg_dump --schema-only` against a fresh database
   built from all current migrations, or by manually merging the net DDL.
3. Remember to include any PL/pgSQL functions and triggers — `drizzle-kit` does not track
   these in its snapshot; they must be carried forward manually.
4. Remember to document any DML-only migrations in this runbook so operators know what to
   run on existing databases.
5. Update `_journal.json` to a single entry for the new baseline tag.
6. Perform the `__drizzle_migrations` surgery on all existing databases (see above).
