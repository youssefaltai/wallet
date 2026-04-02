ALTER TABLE "journal_entries" ADD COLUMN "updated_at" timestamp with time zone NOT NULL DEFAULT now();
