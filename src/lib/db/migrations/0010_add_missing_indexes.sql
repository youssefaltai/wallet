CREATE INDEX "budgets_category_account_idx" ON "budgets" ("category_account_id");
DROP INDEX IF EXISTS "messages_conversation_idx";
CREATE INDEX "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");
