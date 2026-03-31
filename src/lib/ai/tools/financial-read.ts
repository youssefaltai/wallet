import { tool } from "ai";
import * as z from "zod";
import { getAccountsWithBalances, isLiability } from "@/lib/services/accounts";
import {
  getTransactions,
  getSpendingSummary,
  getIncomeSummary,
  getCashFlow,
} from "@/lib/services/transactions";
import { getBudgetStatuses } from "@/lib/services/budgets";
import { getMinorUnitFactor } from "@/lib/constants/currencies";
import { getGoals, getGoalsTotalBalance } from "@/lib/services/goals";
import {
  getExpenseCategories,
  getIncomeCategories,
  getCategoryByName,
} from "@/lib/services/categories";
import { getRates, convert } from "@/lib/services/fx-rates";

export function createFinancialReadTools(userId: string, currency = "USD") {
  return {
    get_accounts: tool({
      description:
        "Get all of the user's accounts (bank, savings, cash, investments) and credits/loans with current balances.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const accts = await getAccountsWithBalances(userId, currency);
          if (accts.length === 0)
            return { accounts: [] as typeof accts, message: "No accounts set up yet." };
          return { accounts: accts };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_transactions: tool({
      description:
        "Search and list transactions. Can filter by account, category, date range, or search text.",
      inputSchema: z.object({
        accountId: z
          .string()
          .uuid()
          .optional()
          .describe("Filter by account ID"),
        category: z
          .string()
          .optional()
          .describe("Filter by category name (e.g. 'Groceries')"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional()
          .describe("Start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
          .optional()
          .describe("End date (YYYY-MM-DD)"),
        search: z
          .string()
          .max(500)
          .optional()
          .describe("Search in transaction descriptions"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results to return (default 20)"),
      }),
      execute: async (params) => {
        try {
          // Resolve category name to ID if provided
          let categoryAccountId: string | undefined;
          if (params.category) {
            const cat =
              (await getCategoryByName(userId, params.category, "expense")) ??
              (await getCategoryByName(userId, params.category, "income"));
            if (cat) categoryAccountId = cat.id;
          }

          const txns = await getTransactions({
            userId,
            accountId: params.accountId,
            categoryAccountId,
            startDate: params.startDate,
            endDate: params.endDate,
            search: params.search,
            limit: params.limit ?? 20,
            currency,
          });
          if (txns.length === 0)
            return { transactions: [] as typeof txns, message: "No matching transactions found." };
          return { transactions: txns };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_spending_summary: tool({
      description:
        "Get a breakdown of spending by category for a date range.",
      inputSchema: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").describe("End date (YYYY-MM-DD)"),
      }),
      execute: async ({ startDate, endDate }) => {
        try {
          const result = await getSpendingSummary(userId, startDate, endDate, currency);
          return { ...result, currency };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_income_summary: tool({
      description:
        "Get a breakdown of income by source for a date range.",
      inputSchema: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").describe("End date (YYYY-MM-DD)"),
      }),
      execute: async ({ startDate, endDate }) => {
        try {
          const result = await getIncomeSummary(userId, startDate, endDate, currency);
          return { ...result, currency };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_budget_status: tool({
      description:
        "Get budgets with how much has been spent vs the budget limit. Defaults to current month if no dates given.",
      inputSchema: z.object({
        periodStart: z
          .string()
          .optional()
          .describe("Only include budgets overlapping on or after this date (YYYY-MM-DD). Defaults to start of current month."),
        periodEnd: z
          .string()
          .optional()
          .describe("Only include budgets overlapping on or before this date (YYYY-MM-DD). Defaults to end of current month."),
      }),
      execute: async ({ periodStart, periodEnd }) => {
        try {
          // Default to current month
          if (!periodStart || !periodEnd) {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();
            periodStart = periodStart ?? new Date(y, m, 1).toISOString().split("T")[0];
            periodEnd = periodEnd ?? new Date(y, m + 1, 0).toISOString().split("T")[0];
          }
          const statuses = await getBudgetStatuses(userId, { periodStart, periodEnd, currency });
          if (statuses.length === 0)
            return { budgets: [] as typeof statuses, message: "No budgets found for this period." };
          return { budgets: statuses };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_goals: tool({
      description: "Get all savings goals with current progress.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const userGoals = await getGoals(userId);
          if (userGoals.length === 0)
            return { goals: [] as typeof userGoals, message: "No goals set up yet." };
          return { goals: userGoals };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_net_worth: tool({
      description:
        "Calculate total net worth: total assets (including goal savings) minus total liabilities. All amounts converted to the user's base currency.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const accts = await getAccountsWithBalances(userId, currency);

          // Convert all account balances to the user's base currency
          const needsConversion = accts.some((a) => a.isActive && a.currency !== currency);
          const rates = needsConversion ? await getRates() : null;

          let assets = 0;
          let liabilities = 0;

          for (const a of accts) {
            if (!a.isActive) continue;
            const converted =
              a.currency === currency
                ? a.balance
                : convert(a.balance, a.currency, currency, rates!);
            if (isLiability(a.type)) {
              liabilities += converted;
            } else {
              assets += converted;
            }
          }

          // Goal savings are real money the user has set aside — count as assets
          const goalBalance = await getGoalsTotalBalance(userId, currency);
          assets += goalBalance;

          const availableToSpend = assets - goalBalance - liabilities;

          return {
            netWorth: assets - liabilities,
            availableToSpend,
            totalAssets: assets,
            totalLiabilities: liabilities,
            goalSavings: goalBalance,
            accountCount: accts.length,
            currency,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_cash_flow: tool({
      description:
        "Get total income vs total expenses for a date range.",
      inputSchema: z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").describe("End date (YYYY-MM-DD)"),
      }),
      execute: async ({ startDate, endDate }) => {
        try {
          const result = await getCashFlow(userId, startDate, endDate, currency);
          return { ...result, currency };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_expense_categories: tool({
      description:
        "Get all expense categories (e.g., Groceries, Rent, Entertainment).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const categories = await getExpenseCategories(userId);
          return { categories: categories.map((c) => ({ id: c.id, name: c.name, currency: c.currency })) };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    get_income_sources: tool({
      description:
        "Get all income sources (e.g., Salary, Freelancing, Interest).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const sources = await getIncomeCategories(userId);
          return { sources: sources.map((c) => ({ id: c.id, name: c.name, currency: c.currency })) };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    convert_currency: tool({
      description:
        "Convert an amount between two currencies using live exchange rates. Also useful for looking up the current exchange rate between any two currencies.",
      inputSchema: z.object({
        amount: z
          .number()
          .positive("Amount must be greater than 0")
          .describe("The amount to convert"),
        from: z
          .string()
          .length(3)
          .describe("Source currency code (e.g. USD, EUR, GBP)"),
        to: z
          .string()
          .length(3)
          .describe("Target currency code (e.g. USD, EUR, GBP)"),
      }),
      execute: async ({ amount, from, to }) => {
        try {
          const fromUpper = from.toUpperCase();
          const toUpper = to.toUpperCase();
          const rates = await getRates();
          const converted = convert(amount, fromUpper, toUpper, rates);
          const rate = convert(1, fromUpper, toUpper, rates);
          return {
            amount,
            from: fromUpper,
            to: toUpper,
            convertedAmount: Math.round(converted * getMinorUnitFactor(toUpper)) / getMinorUnitFactor(toUpper),
            rate: Math.round(rate * 10000) / 10000,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),
  };
}
