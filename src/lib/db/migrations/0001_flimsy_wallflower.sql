ALTER TABLE "budgets" ALTER COLUMN "category_account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_parent_id_fk";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "parent_id";--> statement-breakpoint
DROP INDEX IF EXISTS "memories_embedding_idx";--> statement-breakpoint
ALTER TABLE "memories" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onboarding_completed";