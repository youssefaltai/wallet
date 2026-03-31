-- Add currency column to accounts table (defaults to USD).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Fix category accounts that inherited the schema default "USD"
-- instead of the user's actual base currency.
-- Only updates category accounts (expense/income types) where the user
-- has a non-USD base currency and the account is still at the default.
UPDATE accounts
SET currency = u.currency
FROM users u
WHERE accounts.user_id = u.id
  AND accounts.type IN ('expense', 'income')
  AND accounts.currency = 'USD'
  AND u.currency != 'USD';
