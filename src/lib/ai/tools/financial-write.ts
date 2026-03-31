import { tool } from "ai";
import * as z from "zod";
import { createAccount, updateAccount } from "@/lib/services/accounts";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/services/transactions";
import { createBudget, updateBudget } from "@/lib/services/budgets";
import {
  createGoal,
  updateGoal,
  fundGoal,
  withdrawFromGoal,
} from "@/lib/services/goals";
import { resolveCategory, getCategoryByName } from "@/lib/services/categories";

export function createFinancialWriteTools(userId: string, currency = "USD") {
  return {
    create_account: tool({
      description:
        "Create a new financial account for the user (e.g., checking, savings, credit card).",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .describe("Account name, e.g. 'Chase Checking'"),
        type: z
          .enum(["asset", "liability"])
          .describe(
            "Use 'asset' for bank accounts, cash, savings, investments (things the user owns). Use 'liability' for credit cards, loans, mortgages (things the user owes).",
          ),
        institution: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Bank or institution name"),
      }),
      execute: async (params) => {
        try {
          const account = await createAccount({ userId, ...params });
          return {
            success: true,
            account: { id: account.id, name: account.name, type: account.type },
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
      description: "Update an existing account's details.",
      inputSchema: z.object({
        accountId: z.string().uuid().describe("The account ID to update"),
        name: z.string().max(100).optional(),
        type: z
          .enum(["asset", "liability"])
          .optional()
          .describe(
            "Use 'asset' for things owned, 'liability' for things owed",
          ),
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

    create_transaction: tool({
      description:
        "Record a new transaction. Use a positive amount for both expenses and income — the direction field controls the sign. Category is required.",
      inputSchema: z.object({
        accountId: z
          .string()
          .uuid()
          .describe("The account ID this transaction belongs to"),
        amount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
          .describe(
            "The amount as a positive number (e.g., 50 for fifty dollars)",
          ),
        direction: z
          .enum(["expense", "income"])
          .describe(
            "Whether this is an expense (money out) or income (money in)",
          ),
        category: z
          .string()
          .max(100)
          .describe(
            "Category name like 'Groceries', 'Rent', 'Salary'. Check existing categories first with get_categories. New categories are created automatically.",
          ),
        description: z
          .string()
          .max(500)
          .optional()
          .describe("What the transaction was for (optional)"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .describe("Transaction date in YYYY-MM-DD format"),
        notes: z.string().max(2000).optional().describe("Additional notes"),
      }),
      execute: async (params) => {
        try {
          const categoryType =
            params.direction === "expense"
              ? ("expense" as const)
              : ("income" as const);
          const category = await resolveCategory(
            userId,
            params.category,
            categoryType,
          );

          // expense: debit=category, credit=account
          // income: debit=account, credit=category
          // params.accountId and category.id are both unified accounts.id values
          const debitAccountId =
            params.direction === "expense" ? category.id : params.accountId;
          const creditAccountId =
            params.direction === "expense" ? params.accountId : category.id;

          const txn = await createTransaction({
            userId,
            debitAccountId,
            creditAccountId,
            amount: Math.abs(params.amount),
            description: params.description,
            date: params.date,
            notes: params.notes,
            currency,
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
          };
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
                resolved = await resolveCategory(userId, category, "expense");
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
      }),
      execute: async ({ transactionId }) => {
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

    create_budget: tool({
      description:
        "Create a budget for a specific expense category with a custom date range. A category is required.",
      inputSchema: z.object({
        name: z
          .string()
          .max(100)
          .describe("Budget name, e.g. 'March Food Budget'"),
        amount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
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
          const cat = await resolveCategory(userId, params.category, "expense");
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
        amount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
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
        isActive: z.boolean().optional(),
      }),
      execute: async ({ budgetId, category, ...updates }) => {
        try {
          let categoryAccountId: string | undefined;
          if (category) {
            const cat = await resolveCategory(userId, category, "expense");
            categoryAccountId = cat.id;
          }

          const budget = await updateBudget(budgetId, userId, {
            ...updates,
            ...(categoryAccountId && { categoryAccountId }),
          });
          return {
            success: true,
            budget: { id: budget.id, name: budget.name },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Operation failed",
          };
        }
      },
    }),

    create_goal: tool({
      description:
        "Create a savings goal. The user can then fund it from any account.",
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe("Goal name, e.g. 'Emergency Fund'"),
        targetAmount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
          .describe("Target amount to reach"),
        deadline: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional()
          .describe("Target date (YYYY-MM-DD)"),
        notes: z.string().max(2000).optional(),
      }),
      execute: async (params) => {
        try {
          const goal = await createGoal({ userId, ...params, currency });
          return {
            success: true,
            goal: {
              id: goal.id,
              name: goal.name,
              targetAmount: goal.targetAmount,
              targetAmountFormatted: goal.targetAmountFormatted,
              currentAmount: goal.currentAmount,
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
        targetAmount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
          .optional(),
        deadline: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional(),
        notes: z.string().max(2000).optional(),
      }),
      execute: async ({ goalId, ...updates }) => {
        try {
          const goal = await updateGoal(goalId, userId, updates, currency);
          return {
            success: true,
            goal: {
              id: goal.id,
              name: goal.name,
              currentAmount: goal.currentAmount,
              targetAmount: goal.targetAmount,
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

    fund_goal: tool({
      description:
        "Add money to a goal from one of the user's accounts. This moves real money toward the goal.",
      inputSchema: z.object({
        goalId: z.string().uuid().describe("The goal ID to fund"),
        sourceAccountId: z
          .string()
          .uuid()
          .describe("The account to take money from"),
        amount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
          .describe("Amount to move toward the goal (positive number)"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .describe("Date of the transfer (YYYY-MM-DD)"),
      }),
      execute: async (params) => {
        try {
          const goal = await fundGoal(
            params.goalId,
            userId,
            params.sourceAccountId,
            params.amount,
            params.date,
            currency,
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
        "Move money out of a goal back to one of the user's accounts.",
      inputSchema: z.object({
        goalId: z.string().uuid().describe("The goal ID to withdraw from"),
        destinationAccountId: z
          .string()
          .uuid()
          .describe("The account to move money to"),
        amount: z
          .number()
          .positive("Amount must be greater than 0")
          .max(1_000_000, "Amount cannot exceed 1,000,000")
          .describe("Amount to withdraw (positive number)"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .describe("Date of the transfer (YYYY-MM-DD)"),
      }),
      execute: async (params) => {
        try {
          const goal = await withdrawFromGoal(
            params.goalId,
            userId,
            params.destinationAccountId,
            params.amount,
            params.date,
            currency,
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
  };
}
