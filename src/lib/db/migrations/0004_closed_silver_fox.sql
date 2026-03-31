ALTER TABLE "journal_entries" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "date" SET DEFAULT now();