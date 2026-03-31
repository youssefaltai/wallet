import { db } from "@/lib/db";
import { budgets, accounts } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { toMinorUnits, toMajorUnits, formatMoney } from "./money";

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
    .select({ type: accounts.type })
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
      amount: toMinorUnits(input.amount),
      startDate: input.startDate,
      endDate: input.endDate,
      categoryAccountId: input.categoryAccountId,
    })
    .returning();

  const currency = input.currency ?? "USD";

  return {
    ...budget,
    amount: toMajorUnits(budget.amount),
    amountFormatted: formatMoney(budget.amount, currency),
  };
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
    isActive?: boolean;
  },
  currency = "USD",
) {
  const values: Partial<typeof budgets.$inferInsert> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.amount !== undefined)
    values.amount = toMinorUnits(updates.amount);
  if (updates.startDate !== undefined) values.startDate = updates.startDate;
  if (updates.endDate !== undefined) values.endDate = updates.endDate;
  if (updates.isActive !== undefined) values.isActive = updates.isActive;

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
    amount: toMajorUnits(updated.amount),
    amountFormatted: formatMoney(updated.amount, currency),
  };
}

export interface BudgetStatus {
  id: string;
  name: string;
  categoryAccountId: string;
  categoryName: string;
  budgetAmount: number;
  budgetAmountFormatted: string;
  spent: number;
  spentFormatted: string;
  remaining: number;
  remainingFormatted: string;
  percentUsed: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/** Get a single budget by ID with spent amount computed. */
export async function getBudgetById(
  budgetId: string,
  userId: string,
  currency = "USD",
): Promise<BudgetStatus | null> {
  const rows = await db
    .select({ budget: budgets, categoryName: accounts.name })
    .from(budgets)
    .leftJoin(accounts, eq(budgets.categoryAccountId, accounts.id))
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)))
    .limit(1);

  if (rows.length === 0) return null;
  const { budget, categoryName } = rows[0];

  // Expenses = positive (debit) journal lines on the category account
  const [result] = await db.execute<{ spent: string }>(sql`
    SELECT COALESCE(SUM(jl.amount), 0)::text AS spent
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE je.user_id = ${userId}
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
    budgetAmount: toMajorUnits(budgetMinor),
    budgetAmountFormatted: formatMoney(budgetMinor, currency),
    spent: toMajorUnits(spentMinor),
    spentFormatted: formatMoney(spentMinor, currency),
    remaining: toMajorUnits(remainingMinor),
    remainingFormatted: formatMoney(remainingMinor, currency),
    percentUsed:
      budgetMinor === 0n
        ? 0
        : Math.round((Number(spentMinor) / Number(budgetMinor)) * 100),
    startDate: budget.startDate,
    endDate: budget.endDate,
    isActive: budget.isActive,
  };
}

export interface BudgetDateRange {
  startDate: string;
  endDate: string;
}

/** Get existing budget date ranges for a category (active budgets only). */
export async function getBudgetDateRanges(
  userId: string,
  categoryAccountId: string,
  excludeBudgetId?: string,
): Promise<BudgetDateRange[]> {
  const conditions = [
    eq(budgets.userId, userId),
    eq(budgets.categoryAccountId, categoryAccountId),
    eq(budgets.isActive, true),
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
    .select({ budget: budgets, categoryName: accounts.name })
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
  `);

  const currency = filters?.currency ?? "USD";

  return rows.map((r, i) => {
    const b = r.budget;
    const spentMinor = BigInt(spentRow?.[`spent_${i}`] ?? "0");
    const budgetMinor = b.amount;
    const remainingMinor = budgetMinor - spentMinor;

    return {
      id: b.id,
      name: b.name,
      categoryAccountId: b.categoryAccountId,
      categoryName: r.categoryName ?? "",
      budgetAmount: toMajorUnits(budgetMinor),
      budgetAmountFormatted: formatMoney(budgetMinor, currency),
      spent: toMajorUnits(spentMinor),
      spentFormatted: formatMoney(spentMinor, currency),
      remaining: toMajorUnits(remainingMinor),
      remainingFormatted: formatMoney(remainingMinor, currency),
      percentUsed:
        budgetMinor === 0n
          ? 0
          : Math.round((Number(spentMinor) / Number(budgetMinor)) * 100),
      startDate: b.startDate,
      endDate: b.endDate,
      isActive: b.isActive,
    };
  });
}
