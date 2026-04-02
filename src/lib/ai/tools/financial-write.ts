import { tool } from "ai";
import * as z from "zod";
import { moneyInput, balanceMoney } from "./amount-schemas";
import { formatMoney, toMajorUnits } from "@/lib/services/money";
import { createAccount, updateAccount, getAccountWithBalance, batchCreateAccounts, adjustAccountBalance, equityTransfer } from "@/lib/services/accounts";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  batchCreateTransactions,
  batchDeleteTransactions,
} from "@/lib/services/transactions";
import { createBudget, updateBudget, deleteBudget, batchCreateBudgets, batchDeleteBudgets } from "@/lib/services/budgets";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  fundGoal,
  withdrawFromGoal,
  batchFundGoals,
  batchCreateGoals,
} from "@/lib/services/goals";
import {
  resolveCategory,
  getCategoryByName,
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/lib/services/categories";

/** Convert a YYYY-MM-DD to a full ISO datetime (current UTC time), or pass through if already a datetime */
function toDatetime(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    return new Date(`${dateStr}T${hh}:${mm}:00.000Z`).toISOString();
  }
  return dateStr;
}

export function createFinancialWriteTools(userId: string, currency = "USD") {
  return {
    create_asset_account: tool({
      description:
        "Create a new account for the user (bank account, savings, cash, investments — things the user owns). Each account can have its own currency.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .describe("Account name, e.g. 'Chase Checking'"),
        institution: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Bank or institution name"),
        currency: z
          .string()
          .length(3)
          .optional()
          .describe("ISO 4217 currency code (e.g. USD, EUR, GBP, JPY). Defaults to the user's base currency."),
        initialBalance: balanceMoney
          .optional()
          .describe("Starting balance for the account. If provided, records a proper opening balance entry."),
      }),
      execute: async (params) => {
        try {
          const account = await createAccount({
            userId,
            name: params.name,
            type: "asset",
            institution: params.institution,
            currency: params.currency ?? currency,
            initialBalance: params.initialBalance,
          });
          const withBalance = await getAccountWithBalance(account.id, userId);
          return {
            success: true,
            account: {
              id: account.id,
              name: account.name,
              type: account.type,
              institution: account.institution,
              currency: account.currency,
              balance: withBalance?.balance ?? 0,
              balanceFormatted: withBalance?.balanceFormatted ?? "$0.00",
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    create_liability: tool({
      description:
        "Create a new credit card, loan, or mortgage — anything the user owes. Each can have its own currency.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .describe("Name, e.g. 'Visa Platinum' or 'Car Loan'"),
        institution: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Bank or lender name"),
        currency: z
          .string()
          .length(3)
          .optional()
          .describe("ISO 4217 currency code. Defaults to the user's base currency."),
        initialBalance: balanceMoney
          .optional()
          .describe("Current amount owed on this credit or loan."),
      }),
      execute: async (params) => {
        try {
          const account = await createAccount({
            userId,
            name: params.name,
            type: "liability",
            institution: params.institution,
            currency: params.currency ?? currency,
            initialBalance: params.initialBalance,
          });
          const withBalance = await getAccountWithBalance(account.id, userId);
          return {
            success: true,
            account: {
              id: account.id,
              name: account.name,
              type: account.type,
              institution: account.institution,
              currency: account.currency,
              balance: withBalance?.balance ?? 0,
              balanceFormatted: withBalance?.balanceFormatted ?? "$0.00",
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    update_account: tool({
      description: "Update an existing account or credit/loan's details (name, institution, active status).",
      inputSchema: z.object({
        accountId: z.string().uuid().describe("The account ID to update"),
        name: z.string().max(100).optional(),
        institution: z.string().max(100).optional(),
        isActive: z.boolean().optional(),
      }),
      execute: async ({ accountId, ...updates }) => {
        try {
          const updated = await updateAccount(accountId, userId, updates);
          if (!updated) return { success: false, error: "Account not found" };
          return {
            success: true,
            account: { id: updated.id, name: updated.name },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    adjust_account_balance: tool({
      description:
        "Correct an account's recorded balance to match the actual balance. Posts a correcting entry against Opening Balance Equity — does NOT create a fake income or expense transaction. Use this when a balance is wrong after import, manual error, or initial setup.",
      inputSchema: z.object({
        accountId: z.string().uuid().describe("The account ID to adjust"),
        newBalance: balanceMoney
          .describe("The correct balance in the account's native currency (e.g. 1234.56 or '1,234.56')"),
      }),
      execute: async ({ accountId, newBalance }) => {
        try {
          const result = await adjustAccountBalance(accountId, userId, newBalance);
          return {
            success: true,
            account: {
              id: result.id,
              name: result.name,
              balance: result.balance,
              balanceFormatted: result.balanceFormatted,
              currency: result.currency,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    equity_transfer: tool({
      description:
        "Move a specific amount between an account and Opening Balance Equity. " +
        "Use this to record a pre-existing transaction (one that happened before the app was set up) " +
        "without permanently changing the account's current balance. " +
        "For a pre-existing EXPENSE (account balance already reflects the payment): " +
        "(1) equity_transfer direction='into_account' amount=X — temporarily restores X to the account; " +
        "(2) record_expense X from that account — records the expense, balance returns to original. " +
        "For a pre-existing INCOME (account balance already includes the receipt): " +
        "(1) equity_transfer direction='from_account' amount=X — temporarily removes X from the account; " +
        "(2) record_income X into that account — records the income, balance returns to original. " +
        "Net result in both cases: account balance unchanged, transaction appears in the books. " +
        "direction 'into_account': equity → account (increases balance). " +
        "direction 'from_account': account → equity (decreases balance).",
      inputSchema: z.object({
        accountId: z.string().uuid().describe("The account to transfer to/from"),
        amount: moneyInput.describe("Amount to move"),
        direction: z
          .enum(["into_account", "from_account"])
          .describe(
            "'into_account': moves money from equity into the account, increasing its balance. " +
            "'from_account': moves money from the account into equity, decreasing its balance.",
          ),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Must start with YYYY-MM-DD")
          .describe("Date of the transfer (YYYY-MM-DD)"),
        notes: z.string().max(2000).optional(),
      }),
      execute: async ({ accountId, amount, direction, date, notes }) => {
        try {
          const result = await equityTransfer(accountId, userId, amount, direction, date, notes);
          return {
            success: true,
            account: {
              id: result.id,
              name: result.name,
              balance: result.balance,
              balanceFormatted: result.balanceFormatted,
              currency: result.currency,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    // ── Expense category tools ──────────────────────────────────────────

    create_expense_category: tool({
      description:
        "Create a new expense category for tracking spending (e.g., Groceries, Rent, Entertainment). Check existing categories first with get_expense_categories.",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("Category name, e.g. 'Groceries'"),
        currency: z.string().length(3).optional().describe("ISO 4217 currency code. Defaults to the user's base currency."),
      }),
      execute: async ({ name, currency: cur }) => {
        try {
          const cat = await createCategory(userId, name, "expense", cur ?? currency);
          return { success: true, category: { id: cat.id, name: cat.name } };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    rename_expense_category: tool({
      description: "Rename an existing expense category.",
      inputSchema: z.object({
        categoryId: z.string().uuid().describe("The expense category ID to rename"),
        newName: z.string().min(1).max(100).describe("New name for the category"),
      }),
      execute: async ({ categoryId, newName }) => {
        try {
          const cat = await renameCategory(userId, categoryId, newName);
          return { success: true, category: { id: cat.id, name: cat.name } };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    delete_expense_category: tool({
      description:
        "Delete an expense category. Fails if transactions still use it — reassign them first.",
      inputSchema: z.object({
        categoryId: z.string().uuid().describe("The expense category ID to delete"),
      }),
      execute: async ({ categoryId }) => {
        try {
          await deleteCategory(userId, categoryId);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    // ── Income source tools ─────────────────────────────────────────────

    create_income_source: tool({
      description:
        "Create a new income source for tracking earnings (e.g., Salary, Freelancing, Interest). Check existing sources first with get_income_sources.",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("Source name, e.g. 'Salary'"),
        currency: z.string().length(3).optional().describe("ISO 4217 currency code. Defaults to the user's base currency."),
      }),
      execute: async ({ name, currency: cur }) => {
        try {
          const cat = await createCategory(userId, name, "income", cur ?? currency);
          return { success: true, source: { id: cat.id, name: cat.name } };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    rename_income_source: tool({
      description: "Rename an existing income source.",
      inputSchema: z.object({
        sourceId: z.string().uuid().describe("The income source ID to rename"),
        newName: z.string().min(1).max(100).describe("New name for the income source"),
      }),
      execute: async ({ sourceId, newName }) => {
        try {
          const cat = await renameCategory(userId, sourceId, newName);
          return { success: true, source: { id: cat.id, name: cat.name } };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    delete_income_source: tool({
      description:
        "Delete an income source. Fails if transactions still use it — reassign them first.",
      inputSchema: z.object({
        sourceId: z.string().uuid().describe("The income source ID to delete"),
      }),
      execute: async ({ sourceId }) => {
        try {
          await deleteCategory(userId, sourceId);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    // ── Transactions ────────────────────────────────────────────────────

    record_expense: tool({
      description:
        "Record an expense (money going out of an account). Always use a positive amount. IMPORTANT: Before recording cross-currency expenses, call get_expense_categories to check the category's currency. For cross-currency transactions (account and category use different currencies), provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate. Exchange rate direction: 1 unit of expense category currency = X units of account currency.",
      inputSchema: z.object({
        accountId: z
          .string()
          .uuid()
          .describe("The account the money is leaving"),
        amount: moneyInput
          .describe("The amount in the expense CATEGORY's currency (not the account's currency). E.g., if the category is USD, provide the USD amount."),
        creditAmount: moneyInput
          .optional()
          .describe("Amount in the ACCOUNT's currency (accountId's currency, i.e., the account the money is leaving). Required for cross-currency if exchangeRate is not provided."),
        exchangeRate: z
          .number()
          .positive()
          .optional()
          .describe("Exchange rate: 1 unit of category currency = X units of account currency (e.g. if category is USD and account is EUR, rate 0.9 means 1 USD = 0.9 EUR). Required for cross-currency if creditAmount is not provided."),
        category: z
          .string()
          .max(100)
          .describe("Expense category name (e.g. 'Groceries', 'Rent'). Check existing ones first with get_expense_categories. New ones are created automatically."),
        description: z
          .string()
          .max(500)
          .optional()
          .describe("What the expense was for"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Date must start with YYYY-MM-DD")
          .describe("Transaction date/time. Use YYYY-MM-DD for date only or full ISO 8601 datetime."),
        notes: z.string().max(2000).optional().describe("Additional notes"),
      }),
      execute: async (params) => {
        let category: Awaited<ReturnType<typeof resolveCategory>> | undefined;
        try {
          category = await resolveCategory(userId, params.category, "expense", currency);
          const txn = await createTransaction({
            userId,
            debitAccountId: category.id,
            creditAccountId: params.accountId,
            amount: Math.abs(params.amount),
            creditAmount: params.creditAmount ? Math.abs(params.creditAmount) : undefined,
            exchangeRate: params.exchangeRate,
            description: params.description,
            date: toDatetime(params.date),
            notes: params.notes,
            currency,
            idempotencyKey: crypto.randomUUID(),
          });
          return {
            success: true,
            transaction: {
              id: txn.id,
              amount: txn.amount,
              amountFormatted: txn.amountFormatted,
              description: txn.description,
              category: params.category,
              date: txn.date,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
            ...(category && { hint: `Category "${params.category}" currency is ${category.currency}. "amount" must be in ${category.currency}. "creditAmount" must be in the account's currency.` }),
          };
        }
      },
    }),

    record_income: tool({
      description:
        "Record income (money coming into an account). Always use a positive amount. IMPORTANT: Before recording cross-currency income, call get_income_sources to check the source's currency. For cross-currency transactions (account and income source use different currencies), provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate. Exchange rate direction: 1 unit of account currency = X units of income source currency.",
      inputSchema: z.object({
        accountId: z
          .string()
          .uuid()
          .describe("The account receiving the money"),
        amount: moneyInput
          .describe("The amount in the ACCOUNT's currency (accountId's currency, i.e., the account receiving the money). E.g., if the account is EGP, provide the EGP amount."),
        creditAmount: moneyInput
          .optional()
          .describe("Amount in the INCOME SOURCE's currency (the source's own currency, NOT the receiving account's currency). Required for cross-currency if exchangeRate is not provided."),
        exchangeRate: z
          .number()
          .positive()
          .optional()
          .describe("Exchange rate: 1 unit of account currency = X units of source currency (e.g. if account is EUR and source is USD, rate 1.1 means 1 EUR = 1.1 USD). Required for cross-currency if creditAmount is not provided."),
        source: z
          .string()
          .max(100)
          .describe("Income source name (e.g. 'Salary', 'Freelancing'). Check existing ones first with get_income_sources. New ones are created automatically."),
        description: z
          .string()
          .max(500)
          .optional()
          .describe("What the income was for"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Date must start with YYYY-MM-DD")
          .describe("Transaction date/time. Use YYYY-MM-DD for date only or full ISO 8601 datetime."),
        notes: z.string().max(2000).optional().describe("Additional notes"),
      }),
      execute: async (params) => {
        let source: Awaited<ReturnType<typeof resolveCategory>> | undefined;
        try {
          source = await resolveCategory(userId, params.source, "income", currency);
          const txn = await createTransaction({
            userId,
            debitAccountId: params.accountId,
            creditAccountId: source.id,
            amount: Math.abs(params.amount),
            creditAmount: params.creditAmount ? Math.abs(params.creditAmount) : undefined,
            exchangeRate: params.exchangeRate,
            description: params.description,
            date: toDatetime(params.date),
            notes: params.notes,
            currency,
            idempotencyKey: crypto.randomUUID(),
          });
          return {
            success: true,
            transaction: {
              id: txn.id,
              amount: txn.amount,
              amountFormatted: txn.amountFormatted,
              description: txn.description,
              source: params.source,
              date: txn.date,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
            ...(source && { hint: `Source "${params.source}" currency is ${source.currency}. "amount" must be in the account's currency. "creditAmount" must be in ${source.currency}.` }),
          };
        }
      },
    }),

    record_transfer: tool({
      description:
        "Transfer money between two accounts (e.g., checking → savings, pay off credit card). This is NOT an expense or income — it just moves money. For cross-currency transfers, provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate. Exchange rate direction: 1 unit of destination account currency = X units of source account currency.",
      inputSchema: z.object({
        fromAccountId: z
          .string()
          .uuid()
          .describe("The account sending money"),
        toAccountId: z
          .string()
          .uuid()
          .describe("The account receiving money"),
        amount: moneyInput
          .describe("The amount leaving the source account (in the source account's currency)"),
        creditAmount: moneyInput
          .optional()
          .describe("Amount arriving in the destination account's currency. Required for cross-currency if exchangeRate is not provided."),
        exchangeRate: z
          .number()
          .positive()
          .optional()
          .describe("Exchange rate: 1 unit of destination account currency = X units of source account currency (e.g. if destination is EUR and source is USD, rate 1.1 means 1 EUR = 1.1 USD). Required for cross-currency if creditAmount is not provided."),
        description: z
          .string()
          .max(500)
          .optional()
          .describe("What the transfer is for (e.g. 'Monthly savings')"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Date must start with YYYY-MM-DD")
          .describe("Transfer date/time. Use YYYY-MM-DD for date only or full ISO 8601 datetime."),
        notes: z.string().max(2000).optional().describe("Additional notes"),
      }),
      execute: async (params) => {
        try {
          const txn = await createTransaction({
            userId,
            debitAccountId: params.toAccountId,
            creditAccountId: params.fromAccountId,
            amount: Math.abs(params.amount),
            creditAmount: params.creditAmount ? Math.abs(params.creditAmount) : undefined,
            exchangeRate: params.exchangeRate,
            description: params.description,
            date: toDatetime(params.date),
            notes: params.notes,
            currency,
            idempotencyKey: crypto.randomUUID(),
          });
          return {
            success: true,
            transaction: {
              id: txn.id,
              amount: txn.amount,
              amountFormatted: txn.amountFormatted,
              description: txn.description,
              date: txn.date,
            },
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    update_transaction: tool({
      description: "Update a transaction's description, category, or notes.",
      inputSchema: z.object({
        transactionId: z
          .string()
          .uuid()
          .describe("The transaction ID to update"),
        description: z.string().max(500).optional(),
        category: z.string().max(100).optional().describe("New category name"),
        notes: z.string().max(2000).optional(),
      }),
      execute: async ({ transactionId, category, ...rest }) => {
        try {
          const updates: Parameters<typeof updateTransaction>[2] = { ...rest };

          if (category) {
            // Try expense first, then income — set the appropriate side
            let resolved = await getCategoryByName(userId, category, "expense");
            if (resolved) {
              updates.debitAccountId = resolved.id;
            } else {
              resolved = await getCategoryByName(userId, category, "income");
              if (resolved) {
                updates.creditAccountId = resolved.id;
              } else {
                // Default to expense
                resolved = await resolveCategory(userId, category, "expense", currency);
                updates.debitAccountId = resolved.id;
              }
            }
          }

          const txn = await updateTransaction(transactionId, userId, updates);
          return { success: true, transaction: { id: txn.id } };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    delete_transaction: tool({
      description:
        "Delete a transaction. This also reverses the accounting entry.",
      inputSchema: z.object({
        transactionId: z
          .string()
          .uuid()
          .describe("The transaction ID to delete"),
        confirm: z.boolean().describe("Must be true. Ask the user to confirm deletion before setting this to true."),
      }),
      execute: async ({ transactionId, confirm }) => {
        if (!confirm) {
          return { success: false, error: "Deletion requires explicit user confirmation. Ask the user to confirm before proceeding." };
        }
        try {
          await deleteTransaction(transactionId, userId);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    // ── Budgets ──────────────────────────────────────────────────────────

    create_budget: tool({
      description:
        "Create a budget for a specific expense category with a custom date range. A category is required.",
      inputSchema: z.object({
        name: z
          .string()
          .max(100)
          .describe("Budget name, e.g. 'March Food Budget'"),
        amount: moneyInput
          .describe("Budget limit amount"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .describe("Start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .describe("End date (YYYY-MM-DD)"),
        category: z
          .string()
          .min(1)
          .describe("Expense category name to track (required)."),
      }),
      execute: async (params) => {
        try {
          const cat = await resolveCategory(userId, params.category, "expense", currency);
          const categoryAccountId = cat.id;

          const budget = await createBudget({
            userId,
            name: params.name,
            amount: params.amount,
            startDate: params.startDate,
            endDate: params.endDate,
            categoryAccountId,
            currency,
          });
          return {
            success: true,
            budget: {
              id: budget.id,
              name: budget.name,
              amount: budget.amount,
              amountFormatted: budget.amountFormatted,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    update_budget: tool({
      description: "Update a budget's details.",
      inputSchema: z.object({
        budgetId: z.string().uuid().describe("The budget ID to update"),
        name: z.string().max(100).optional(),
        amount: moneyInput
          .optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional(),
        category: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Expense category name"),
      }),
      execute: async ({ budgetId, category, ...updates }) => {
        try {
          let categoryAccountId: string | undefined;
          if (category) {
            const cat = await resolveCategory(userId, category, "expense", currency);
            categoryAccountId = cat.id;
          }

          const budget = await updateBudget(budgetId, userId, {
            ...updates,
            ...(categoryAccountId && { categoryAccountId }),
          });
          return {
            success: true,
            budget: {
              id: budget.id,
              name: budget.name,
              amount: budget.amount,
              amountFormatted: budget.amountFormatted,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    delete_budget: tool({
      description: "Permanently delete a budget. This cannot be undone.",
      inputSchema: z.object({
        budgetId: z.string().uuid().describe("The budget ID to delete"),
      }),
      execute: async ({ budgetId }) => {
        try {
          await deleteBudget(userId, budgetId);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    // ── Goals ────────────────────────────────────────────────────────────

    create_goal: tool({
      description:
        "Create a savings goal. The user can then fund it from any account.",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("Goal name, e.g. 'Emergency Fund'"),
        targetAmount: moneyInput
          .describe("Target amount to reach"),
        deadline: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional()
          .describe("Target date (YYYY-MM-DD)"),
        currency: z.string().length(3).optional().describe("ISO 4217 currency code for the goal. Defaults to the user's base currency."),
        notes: z.string().max(2000).optional(),
      }),
      execute: async (params) => {
        try {
          const goal = await createGoal({ userId, ...params, currency: params.currency ?? currency });
          return {
            success: true,
            goal: {
              id: goal.id,
              name: goal.name,
              targetAmount: goal.targetAmount,
              targetAmountFormatted: goal.targetAmountFormatted,
              currentAmount: goal.currentAmount,
              currentAmountFormatted: goal.currentAmountFormatted,
              progressPercent: goal.progressPercent,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    update_goal: tool({
      description: "Update a goal's details (name, target, deadline, notes).",
      inputSchema: z.object({
        goalId: z.string().uuid().describe("The goal ID to update"),
        name: z.string().max(100).optional(),
        targetAmount: moneyInput
          .optional(),
        deadline: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional(),
        notes: z.string().max(2000).optional(),
      }),
      execute: async ({ goalId, ...updates }) => {
        try {
          const goal = await updateGoal(goalId, userId, updates);
          return {
            success: true,
            goal: {
              id: goal.id,
              name: goal.name,
              currentAmount: goal.currentAmount,
              currentAmountFormatted: goal.currentAmountFormatted,
              targetAmount: goal.targetAmount,
              targetAmountFormatted: goal.targetAmountFormatted,
              progressPercent: goal.progressPercent,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    delete_goal: tool({
      description:
        "Permanently delete a savings goal and its backing account. Only allowed when the goal has no transactions — use withdraw_from_goal to empty it first if needed. This cannot be undone.",
      inputSchema: z.object({
        goalId: z.string().uuid().describe("The goal ID to delete"),
        confirm: z.boolean().describe("Must be true. Ask the user to confirm deletion before setting this to true."),
      }),
      execute: async ({ goalId, confirm }) => {
        if (!confirm) {
          return { success: false, error: "Deletion requires explicit user confirmation. Ask the user to confirm before proceeding." };
        }
        try {
          await deleteGoal(goalId, userId);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    fund_goal: tool({
      description:
        "Add money to a goal from one of the user's accounts. This moves real money toward the goal. For cross-currency (source account and goal use different currencies), provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate.",
      inputSchema: z.object({
        goalId: z.string().uuid().describe("The goal ID to fund"),
        sourceAccountId: z
          .string()
          .uuid()
          .describe("The account to take money from"),
        amount: moneyInput
          .describe("Amount in the SOURCE ACCOUNT's currency (positive number)"),
        creditAmount: moneyInput
          .optional()
          .describe("Amount in the GOAL's currency. Required for cross-currency if exchangeRate is not provided."),
        exchangeRate: z
          .number()
          .positive()
          .optional()
          .describe("Exchange rate: 1 unit of source account currency = X units of goal currency. Required for cross-currency if creditAmount is not provided."),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Date must start with YYYY-MM-DD")
          .describe("Date/time of the transfer. YYYY-MM-DD or full ISO 8601 datetime."),
      }),
      execute: async (params) => {
        try {
          const goal = await fundGoal(
            params.goalId,
            userId,
            params.sourceAccountId,
            params.amount,
            toDatetime(params.date),
            params.creditAmount,
            params.exchangeRate,
            crypto.randomUUID(),
          );
          return {
            success: true,
            goal: {
              id: goal.id,
              name: goal.name,
              currentAmount: goal.currentAmount,
              currentAmountFormatted: goal.currentAmountFormatted,
              targetAmount: goal.targetAmount,
              targetAmountFormatted: goal.targetAmountFormatted,
              progressPercent: goal.progressPercent,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    withdraw_from_goal: tool({
      description:
        "Move money out of a goal back to one of the user's accounts. For cross-currency (goal and destination account use different currencies), provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate.",
      inputSchema: z.object({
        goalId: z.string().uuid().describe("The goal ID to withdraw from"),
        destinationAccountId: z
          .string()
          .uuid()
          .describe("The account to move money to"),
        amount: moneyInput
          .describe("Amount in the GOAL's currency (positive number)"),
        creditAmount: moneyInput
          .optional()
          .describe("Amount in the DESTINATION ACCOUNT's currency. Required for cross-currency if exchangeRate is not provided."),
        exchangeRate: z
          .number()
          .positive()
          .optional()
          .describe("Exchange rate: 1 unit of goal currency = X units of destination account currency. Required for cross-currency if creditAmount is not provided."),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}/, "Date must start with YYYY-MM-DD")
          .describe("Date/time of the transfer. YYYY-MM-DD or full ISO 8601 datetime."),
      }),
      execute: async (params) => {
        try {
          const goal = await withdrawFromGoal(
            params.goalId,
            userId,
            params.destinationAccountId,
            params.amount,
            toDatetime(params.date),
            params.creditAmount,
            params.exchangeRate,
            crypto.randomUUID(),
          );
          return {
            success: true,
            goal: {
              id: goal.id,
              name: goal.name,
              currentAmount: goal.currentAmount,
              currentAmountFormatted: goal.currentAmountFormatted,
              targetAmount: goal.targetAmount,
              targetAmountFormatted: goal.targetAmountFormatted,
              progressPercent: goal.progressPercent,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    // ── Batch operations ────────────────────────────────────────────────

    batch_create_transactions: tool({
      description:
        "Create multiple transactions at once (all-or-nothing). Use this instead of calling record_expense/record_income/record_transfer in a loop. Maximum 50 items. Each item specifies its type. For cross-currency transactions, provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate.",
      inputSchema: z.object({
        items: z
          .array(
            z.discriminatedUnion("type", [
              z.object({
                type: z.literal("expense"),
                accountId: z.string().uuid().describe("The account the money is leaving"),
                amount: moneyInput.describe("Amount in the expense CATEGORY's currency"),
                creditAmount: moneyInput.optional().describe("Amount in the ACCOUNT's currency (accountId's currency). Required for cross-currency if exchangeRate is not provided."),
                exchangeRate: z.number().positive().optional().describe("1 unit of category currency = X units of account currency. For cross-currency expenses."),
                category: z.string().max(100).describe("Expense category name (auto-created if new)"),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must start with YYYY-MM-DD"),
                description: z.string().max(500).optional(),
                notes: z.string().max(2000).optional(),
              }),
              z.object({
                type: z.literal("income"),
                accountId: z.string().uuid().describe("The account receiving the money"),
                amount: moneyInput.describe("Amount in the ACCOUNT's currency (accountId's currency, the receiving account)"),
                creditAmount: moneyInput.optional().describe("Amount in the INCOME SOURCE's currency (the source's own currency, NOT the account's). Required for cross-currency if exchangeRate is not provided."),
                exchangeRate: z.number().positive().optional().describe("1 unit of account currency = X units of source currency. For cross-currency income."),
                source: z.string().max(100).describe("Income source name (auto-created if new)"),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must start with YYYY-MM-DD"),
                description: z.string().max(500).optional(),
                notes: z.string().max(2000).optional(),
              }),
              z.object({
                type: z.literal("transfer"),
                fromAccountId: z.string().uuid().describe("The account sending money"),
                toAccountId: z.string().uuid().describe("The account receiving money"),
                amount: moneyInput.describe("Positive amount"),
                creditAmount: moneyInput.optional().describe("Amount in destination currency for cross-currency"),
                exchangeRate: z.number().positive().optional().describe("1 unit of destination currency = X units of source currency. For cross-currency transfers."),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must start with YYYY-MM-DD"),
                description: z.string().max(500).optional(),
                notes: z.string().max(2000).optional(),
              }),
            ]),
          )
          .min(1)
          .max(50),
      }),
      execute: async ({ items }) => {
        try {
          const inputs = await Promise.all(
            items.map(async (item) => {
              if (item.type === "expense") {
                const category = await resolveCategory(userId, item.category, "expense", currency);
                return {
                  userId,
                  debitAccountId: category.id,
                  creditAccountId: item.accountId,
                  amount: Math.abs(item.amount),
                  creditAmount: item.creditAmount ? Math.abs(item.creditAmount) : undefined,
                  exchangeRate: item.exchangeRate,
                  description: item.description,
                  date: toDatetime(item.date),
                  notes: item.notes,
                  currency,
                  idempotencyKey: crypto.randomUUID(),
                };
              } else if (item.type === "income") {
                const source = await resolveCategory(userId, item.source, "income", currency);
                return {
                  userId,
                  debitAccountId: item.accountId,
                  creditAccountId: source.id,
                  amount: Math.abs(item.amount),
                  creditAmount: item.creditAmount ? Math.abs(item.creditAmount) : undefined,
                  exchangeRate: item.exchangeRate,
                  description: item.description,
                  date: toDatetime(item.date),
                  notes: item.notes,
                  currency,
                  idempotencyKey: crypto.randomUUID(),
                };
              } else {
                return {
                  userId,
                  debitAccountId: item.toAccountId,
                  creditAccountId: item.fromAccountId,
                  amount: Math.abs(item.amount),
                  creditAmount: item.creditAmount ? Math.abs(item.creditAmount) : undefined,
                  exchangeRate: item.exchangeRate,
                  description: item.description,
                  date: toDatetime(item.date),
                  notes: item.notes,
                  currency,
                  idempotencyKey: crypto.randomUUID(),
                };
              }
            }),
          );

          const result = await batchCreateTransactions(inputs);
          return {
            success: true,
            count: result.count,
            totals: result.totals.map((t) => ({
              currency: t.currency,
              totalAmount: toMajorUnits(t.totalMinor, t.currency),
              totalAmountFormatted: formatMoney(t.totalMinor, t.currency),
            })),
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),

    batch_delete_transactions: tool({
      description:
        "Delete multiple transactions at once (all-or-nothing). Use this instead of calling delete_transaction in a loop. Maximum 50 items.",
      inputSchema: z.object({
        transactionIds: z
          .array(z.string().uuid())
          .min(1)
          .max(50)
          .describe("Array of transaction IDs to delete"),
        confirm: z.boolean().describe("Must be true. Ask the user to confirm deletion before setting this to true."),
      }),
      execute: async ({ transactionIds, confirm }) => {
        if (!confirm) {
          return { success: false, error: "Deletion requires explicit user confirmation. Ask the user to confirm before proceeding." };
        }
        try {
          const result = await batchDeleteTransactions(transactionIds, userId);
          return { success: true, count: result.count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),

    batch_fund_goals: tool({
      description:
        "Fund multiple goals at once from one or more accounts (all-or-nothing). Use this to distribute savings across goals, e.g. after receiving a paycheck. Maximum 20 items. For cross-currency items (source account and goal use different currencies), provide any two of: amount + creditAmount, amount + exchangeRate, or creditAmount + exchangeRate.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              goalId: z.string().uuid().describe("The goal ID to fund"),
              sourceAccountId: z.string().uuid().describe("The account to take money from"),
              amount: moneyInput
                .describe("Amount in the SOURCE ACCOUNT's currency (positive number)"),
              creditAmount: moneyInput
                .optional()
                .describe("Amount in the GOAL's currency. Required for cross-currency if exchangeRate is not provided."),
              exchangeRate: z
                .number()
                .positive()
                .optional()
                .describe("Exchange rate: 1 unit of source account currency = X units of goal currency. Required for cross-currency if creditAmount is not provided."),
              date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}/, "Must start with YYYY-MM-DD")
                .describe("Date of the transfer"),
            }),
          )
          .min(1)
          .max(20),
      }),
      execute: async ({ items }) => {
        try {
          const result = await batchFundGoals(
            userId,
            items.map((item) => ({
              goalId: item.goalId,
              sourceAccountId: item.sourceAccountId,
              amount: item.amount,
              creditAmount: item.creditAmount,
              exchangeRate: item.exchangeRate,
              date: toDatetime(item.date),
              idempotencyKey: crypto.randomUUID(),
            })),
          );
          return { success: true, count: result.count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),

    batch_create_goals: tool({
      description:
        "Create multiple savings goals at once (all-or-nothing). Use this when setting up several goals together, e.g. during initial planning. Maximum 20 items.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(100).describe("Goal name, e.g. 'Emergency Fund'"),
              targetAmount: moneyInput
                .describe("Target amount to reach"),
              deadline: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
                .optional()
                .describe("Target date"),
              notes: z.string().max(2000).optional(),
            }),
          )
          .min(1)
          .max(20),
      }),
      execute: async ({ items }) => {
        try {
          const result = await batchCreateGoals(
            items.map((item) => ({ userId, ...item, currency })),
          );
          return { success: true, count: result.count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),

    batch_create_accounts: tool({
      description:
        "Create multiple accounts and credits/loans at once (all-or-nothing). Use this during onboarding when the user describes all their accounts. Maximum 20 items.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(100).describe("Account name, e.g. 'Chase Checking'"),
              type: z
                .enum(["asset", "liability"])
                .describe("'asset' for bank accounts, savings, cash, investments. 'liability' for credit cards, loans, mortgages."),
              institution: z.string().max(100).optional().describe("Bank or institution name"),
              currency: z.string().length(3).optional().describe("ISO 4217 currency code. Defaults to user's base currency."),
              initialBalance: balanceMoney
                .optional()
                .describe("Starting balance (for assets) or amount owed (for liabilities)."),
            }),
          )
          .min(1)
          .max(20),
      }),
      execute: async ({ items }) => {
        try {
          const result = await batchCreateAccounts(
            items.map((item) => ({
              userId,
              name: item.name,
              type: item.type,
              institution: item.institution,
              currency: item.currency ?? currency,
              initialBalance: item.initialBalance,
            })),
          );
          return { success: true, count: result.count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),

    batch_create_budgets: tool({
      description:
        "Create monthly budgets in bulk. Each item generates budgets for consecutive months with correct date ranges. Use this for setting up annual or multi-month budgets. Maximum 20 items.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              amount: moneyInput
                .describe("Monthly budget amount"),
              category: z
                .string()
                .min(1)
                .max(100)
                .describe("Expense category name (auto-created if new)"),
              startMonth: z
                .string()
                .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM")
                .describe("First month (e.g. '2026-01')"),
              months: z
                .number()
                .int()
                .min(1)
                .max(12)
                .describe("Number of consecutive months (1-12)"),
              nameTemplate: z
                .string()
                .max(100)
                .optional()
                .describe("Budget name template. Use {month} and {category} as placeholders. Default: '{month} {category}'"),
              currency: z
                .string()
                .length(3)
                .optional()
                .describe(
                  "ISO 4217 currency for this budget's expense category (e.g. 'EGP'). " +
                  "Use this when the user specifies amounts in a currency other than their profile default. " +
                  "Only affects new categories — existing ones keep their stored currency.",
                ),
            }),
          )
          .min(1)
          .max(20),
      }),
      execute: async ({ items }) => {
        try {
          const result = await batchCreateBudgets(userId, items, currency);
          return { success: true, count: result.count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),

    batch_delete_budgets: tool({
      description:
        "Delete multiple budgets at once (all-or-nothing). Use this instead of calling delete_budget in a loop. Maximum 50 items.",
      inputSchema: z.object({
        budgetIds: z
          .array(z.string().uuid())
          .min(1)
          .max(50)
          .describe("Array of budget IDs to delete"),
        confirm: z.boolean().describe("Must be true. Ask the user to confirm deletion before setting this to true."),
      }),
      execute: async ({ budgetIds, confirm }) => {
        if (!confirm) {
          return { success: false, error: "Deletion requires explicit user confirmation. Ask the user to confirm before proceeding." };
        }
        try {
          const result = await batchDeleteBudgets(budgetIds, userId);
          return { success: true, count: result.count };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Operation failed";
          const indexMatch = msg.match(/^Item (\d+): (.+)/);
          if (indexMatch) {
            return { success: false, failedIndex: parseInt(indexMatch[1], 10), error: indexMatch[2] };
          }
          return { success: false, error: msg };
        }
      },
    }),
  };
}
