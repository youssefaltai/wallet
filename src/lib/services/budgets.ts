import { db } from "@/lib/db";
import { budgets, accounts } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { toMinorUnits, toMajorUnits, formatMoney } from "./money";
import { resolveCategory } from "./categories";

export interface CreateBudgetInput {
  userId: string;
  name: string;
  amount: number; // major units
  startDate: string;
  endDate: string;
  categoryAccountId: string; // FK to expense account (required)
  currency?: string;
}

export async function createBudget(input: CreateBudgetInput) {
  // Validate that the category is an expense-type account owned by the user
  const [account] = await db
    .select({ type: accounts.type, currency: accounts.currency })
    .from(accounts)
    .where(and(eq(accounts.id, input.categoryAccountId), eq(accounts.userId, input.userId)))
    .limit(1);

  if (!account) throw new Error("Category not found");
  if (account.type !== "expense")
    throw new Error("Budget category must be an expense category");

  const [budget] = await db
    .insert(budgets)
    .values({
      userId: input.userId,
      name: input.name,
      amount: toMinorUnits(input.amount, account.currency),
      startDate: input.startDate,
      endDate: input.endDate,
      categoryAccountId: input.categoryAccountId,
    })
    .returning();

  const currency = account.currency;

  return {
    ...budget,
    amount: toMajorUnits(budget.amount, currency),
    amountFormatted: formatMoney(budget.amount, currency),
  };
}

export async function deleteBudget(userId: string, budgetId: string) {
  const [deleted] = await db
    .delete(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .returning({ id: budgets.id });

  if (!deleted) throw new Error("Budget not found");
  return deleted;
}

export async function batchDeleteBudgets(
  budgetIds: string[],
  userId: string,
): Promise<{ count: number }> {
  if (budgetIds.length === 0) throw new Error("No budgets to delete");
  if (budgetIds.length > 50) throw new Error("Maximum 50 budgets per batch");

  return db.transaction(async (tx) => {
    for (let i = 0; i < budgetIds.length; i++) {
      try {
        const [deleted] = await tx
          .delete(budgets)
          .where(and(eq(budgets.id, budgetIds[i]), eq(budgets.userId, userId)))
          .returning({ id: budgets.id });
        if (!deleted) throw new Error("Budget not found");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Operation failed";
        if (msg.startsWith("Item ")) throw error;
        throw new Error(`Item ${i}: ${msg}`);
      }
    }
    return { count: budgetIds.length };
  });
}

export async function updateBudget(
  budgetId: string,
  userId: string,
  updates: {
    name?: string;
    amount?: number;
    startDate?: string;
    endDate?: string;
    categoryAccountId?: string;
  },
  _currency = "USD",
) {
  // Fetch budget with category currency for correct minor-unit conversion
  const [current] = await db
    .select({
      categoryAccountId: budgets.categoryAccountId,
      categoryAccountCurrency: accounts.currency,
    })
    .from(budgets)
    .leftJoin(accounts, eq(budgets.categoryAccountId, accounts.id))
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .limit(1);
  if (!current) throw new Error("Budget not found");
  const budgetCurrency = current.categoryAccountCurrency ?? "USD";

  const values: Partial<typeof budgets.$inferInsert> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.amount !== undefined)
    values.amount = toMinorUnits(updates.amount, budgetCurrency);
  if (updates.startDate !== undefined) values.startDate = updates.startDate;
  if (updates.endDate !== undefined) values.endDate = updates.endDate;

  if (updates.categoryAccountId !== undefined) {
    const [account] = await db
      .select({ type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, updates.categoryAccountId), eq(accounts.userId, userId)))
      .limit(1);

    if (!account) throw new Error("Category not found");
    if (account.type !== "expense")
      throw new Error("Budget category must be an expense category");

    values.categoryAccountId = updates.categoryAccountId;
  }

  const [updated] = await db
    .update(budgets)
    .set(values)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .returning();

  if (!updated) throw new Error("Budget not found");

  return {
    ...updated,
    amount: toMajorUnits(updated.amount, budgetCurrency),
    amountFormatted: formatMoney(updated.amount, budgetCurrency),
  };
}

// ── Batch ────────────────────────────────────────────────────────────────

export interface BatchBudgetItem {
  amount: number; // major units per month
  category: string; // category name (auto-resolved)
  startMonth: string; // "YYYY-MM"
  months: number; // 1–12
  nameTemplate?: string; // default: "{month} {category}"
  currency?: string; // ISO 4217 currency code (defaults to session currency)
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Create monthly budgets in bulk (all-or-nothing).
 * Each item expands into `months` individual budgets with correct date ranges.
 */
export async function batchCreateBudgets(
  userId: string,
  items: BatchBudgetItem[],
  currency: string,
): Promise<{ count: number }> {
  if (items.length === 0) throw new Error("No budgets to create");
  if (items.length > 20) throw new Error("Maximum 20 items per batch");

  return db.transaction(async (tx) => {
    let count = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.months < 1 || item.months > 12) {
        throw new Error(`Item ${i}: months must be between 1 and 12`);
      }

      try {
        const itemCurrency = item.currency ?? currency;
        const cat = await resolveCategory(userId, item.category, "expense", itemCurrency, tx);
        const template = item.nameTemplate ?? "{month} {category}";

        const [startYear, startMonthNum] = item.startMonth.split("-").map(Number);

        for (let m = 0; m < item.months; m++) {
          const year = startYear + Math.floor((startMonthNum - 1 + m) / 12);
          const month = ((startMonthNum - 1 + m) % 12); // 0-indexed
          const monthName = MONTH_NAMES[month];

          const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
          const lastDay = new Date(year, month + 1, 0).getDate();
          const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

          const name = template
            .replace("{month}", monthName)
            .replace("{category}", item.category);

          await tx.insert(budgets).values({
            userId,
            name,
            amount: toMinorUnits(item.amount, cat.currency),
            startDate,
            endDate,
            categoryAccountId: cat.id,
          });

          count++;
        }
      } catch (error) {
        // Re-throw with item index if not already prefixed
        const msg = error instanceof Error ? error.message : "Operation failed";
        if (msg.startsWith("Item ")) throw error;
        throw new Error(`Item ${i}: ${msg}`);
      }
    }

    return { count };
  });
}

export interface BudgetStatus {
  id: string;
  name: string;
  categoryAccountId: string;
  categoryName: string;
  currency: string;
  budgetAmount: number;
  budgetAmountFormatted: string;
  spent: number;
  spentFormatted: string;
  remaining: number;
  remainingFormatted: string;
  percentUsed: number;
  startDate: string;
  endDate: string;
}

/** Get a single budget by ID with spent amount computed. */
export async function getBudgetById(
  budgetId: string,
  userId: string,
  _currency = "USD",
): Promise<BudgetStatus | null> {
  const rows = await db
    .select({ budget: budgets, categoryName: accounts.name, categoryAccountCurrency: accounts.currency })
    .from(budgets)
    .leftJoin(accounts, eq(budgets.categoryAccountId, accounts.id))
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;
  const { budget, categoryName, categoryAccountCurrency } = rows[0];
  const budgetCurrency = categoryAccountCurrency ?? "USD";

  // Expenses = positive (debit) journal lines on the category account
  const [result] = await db.execute<{ spent: string }>(sql`
    SELECT COALESCE(SUM(jl.amount), 0)::text AS spent
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE je.user_id = ${userId}
      AND je.deleted_at IS NULL
      AND jl.account_id = ${budget.categoryAccountId}
      AND jl.amount > 0
      AND je.date BETWEEN ${budget.startDate} AND ${budget.endDate}
  `);

  const spentMinor = BigInt(result?.spent ?? "0");
  const budgetMinor = budget.amount;
  const remainingMinor = budgetMinor - spentMinor;

  return {
    id: budget.id,
    name: budget.name,
    categoryAccountId: budget.categoryAccountId,
    categoryName: categoryName ?? "",
    currency: budgetCurrency,
    budgetAmount: toMajorUnits(budgetMinor, budgetCurrency),
    budgetAmountFormatted: formatMoney(budgetMinor, budgetCurrency),
    spent: toMajorUnits(spentMinor, budgetCurrency),
    spentFormatted: formatMoney(spentMinor, budgetCurrency),
    remaining: toMajorUnits(remainingMinor, budgetCurrency),
    remainingFormatted: formatMoney(remainingMinor, budgetCurrency),
    percentUsed:
      budgetMinor === 0n
        ? 0
        : Math.round((Number(spentMinor) / Number(budgetMinor)) * 100),
    startDate: budget.startDate,
    endDate: budget.endDate,
  };
}

export interface BudgetDateRange {
  startDate: string;
  endDate: string;
}

/** Get existing budget date ranges for a category. */
export async function getBudgetDateRanges(
  userId: string,
  categoryAccountId: string,
  excludeBudgetId?: string,
): Promise<BudgetDateRange[]> {
  const conditions = [
    eq(budgets.userId, userId),
    eq(budgets.categoryAccountId, categoryAccountId),
  ];

  if (excludeBudgetId) {
    conditions.push(sql`${budgets.id} != ${excludeBudgetId}`);
  }

  return db
    .select({ startDate: budgets.startDate, endDate: budgets.endDate })
    .from(budgets)
    .where(and(...conditions))
    .orderBy(budgets.startDate);
}

export interface BudgetFilters {
  periodStart?: string;
  periodEnd?: string;
  currency?: string;
}

/** Get budgets for a user with spent amounts computed in a single query. */
export async function getBudgetStatuses(
  userId: string,
  filters?: BudgetFilters,
): Promise<BudgetStatus[]> {
  const budgetConditions = [eq(budgets.userId, userId)];

  if (filters?.periodStart) {
    budgetConditions.push(sql`${budgets.endDate} >= ${filters.periodStart}`);
  }
  if (filters?.periodEnd) {
    budgetConditions.push(sql`${budgets.startDate} <= ${filters.periodEnd}`);
  }

  const rows = await db
    .select({ budget: budgets, categoryName: accounts.name, categoryAccountCurrency: accounts.currency })
    .from(budgets)
    .leftJoin(accounts, eq(budgets.categoryAccountId, accounts.id))
    .where(and(...budgetConditions))
    .orderBy(budgets.startDate);

  if (rows.length === 0) return [];

  // Compute spent per budget in one aggregation pass over journal_lines.
  // Each budget's spent = sum of positive (debit) lines on its category account
  // within its date range.
  const spentCases = rows.map((r, i) => {
    const b = r.budget;
    return sql`COALESCE(SUM(
      CASE
        WHEN jl.account_id = ${b.categoryAccountId}
         AND jl.amount > 0
         AND je.date >= ${b.startDate}
         AND je.date <= ${b.endDate}
        THEN jl.amount
        ELSE 0
      END
    ), 0)::text AS ${sql.raw(`spent_${i}`)}`;
  });

  const [spentRow] = await db.execute<Record<string, string>>(sql`
    SELECT ${sql.join(spentCases, sql`, `)}
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE je.user_id = ${userId}
      AND je.deleted_at IS NULL
  `);

  return rows.map((r, i) => {
    const b = r.budget;
    const budgetCurrency = r.categoryAccountCurrency ?? "USD";
    const spentMinor = BigInt(spentRow?.[`spent_${i}`] ?? "0");
    const budgetMinor = b.amount;
    const remainingMinor = budgetMinor - spentMinor;

    return {
      id: b.id,
      name: b.name,
      categoryAccountId: b.categoryAccountId,
      categoryName: r.categoryName ?? "",
      currency: budgetCurrency,
      budgetAmount: toMajorUnits(budgetMinor, budgetCurrency),
      budgetAmountFormatted: formatMoney(budgetMinor, budgetCurrency),
      spent: toMajorUnits(spentMinor, budgetCurrency),
      spentFormatted: formatMoney(spentMinor, budgetCurrency),
      remaining: toMajorUnits(remainingMinor, budgetCurrency),
      remainingFormatted: formatMoney(remainingMinor, budgetCurrency),
      percentUsed:
        budgetMinor === 0n
          ? 0
          : Math.round((Number(spentMinor) / Number(budgetMinor)) * 100),
      startDate: b.startDate,
      endDate: b.endDate,
    };
  });
}
