ALTER TABLE "budgets" DROP CONSTRAINT "budgets_category_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_account_id_accounts_id_fk" FOREIGN KEY ("category_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;