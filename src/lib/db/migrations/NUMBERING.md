# Migration Numbering History

This directory has non-sequential numbering in the migration filenames. This is a historical artifact and is **safe to ignore** — Drizzle tracks applied migrations by the `tag` field in `meta/_journal.json`, not by filename.

## Known gaps and duplicates

| Journal idx | Tag (what Drizzle uses) | Filename on disk |
|-------------|-------------------------|------------------|
| 0 | `0000_cool_daredevil` | `0000_cool_daredevil.sql` |
| 1 | `0001_flimsy_wallflower` | `0001_flimsy_wallflower.sql` |
| 2 | `0002_cool_magma` | `0002_cool_magma.sql` |
| 3 | `0004_closed_silver_fox` | `0004_closed_silver_fox.sql` ← no `0003_*` exists |
| 4 | `0004_smooth_fixer` | `0004_smooth_fixer.sql` ← duplicate `0004_` prefix |
| 5 | `0005_fix_category_currencies` | `0005_fix_category_currencies.sql` |
| 6 | `0005_cold_matthew_murdock` | `0005_cold_matthew_murdock.sql` ← duplicate `0005_` prefix |
| 7 | `0006_new_doorman` | `0006_new_doorman.sql` |
| 8 | `0007_sticky_ricochet` | `0007_sticky_ricochet.sql` |
| 9 | `0008_soft_delete_journal_entries` | `0008_soft_delete_journal_entries.sql` |
| 10 | `0009_journal_zero_sum_trigger` | `0009_journal_zero_sum_trigger.sql` |
| 11 | `0010_add_missing_indexes` | `0010_add_missing_indexes.sql` |
| 12 | `0011_journal_entries_updated_at` | `0011_journal_entries_updated_at.sql` |

## Why these cannot be safely renamed

The tags in `meta/_journal.json` have already been applied to the production database's `__drizzle_migrations` table. Renaming a tag would cause Drizzle to treat the renamed migration as a new, unapplied migration and attempt to re-run it — potentially corrupting data.

## How to avoid this in future

`drizzle-kit generate` assigns the next sequential number based on the highest existing prefix in `_journal.json`. If you ever manually create or edit migration files outside of `drizzle-kit generate`, ensure the tag you assign is strictly one higher than the current maximum to avoid collisions.
