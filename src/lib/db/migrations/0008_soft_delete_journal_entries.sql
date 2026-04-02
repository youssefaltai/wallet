ALTER TABLE "journal_entries" ADD COLUMN "deleted_at" timestamp with time zone;
CREATE INDEX "journal_entries_deleted_at_idx" ON "journal_entries" ("deleted_at") WHERE "deleted_at" IS NOT NULL;
