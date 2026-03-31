/**
 * Category service — expense and income categories.
 *
 * Categories are rows in the unified accounts table with
 * type = 'expense' or type = 'income'. They are never shown
 * as "accounts" — the accounts service filters them out.
 *
 * Names are stored as-is (no internal prefixes).
 */

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq, and, asc, sql, or } from "drizzle-orm";
import { getOrCreateAccount } from "./accounts";
import { toMajorUnits, formatMoney } from "./money";
import type { Tx } from "./ledger";

export interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  currency: string;
}

type CategoryType = Category["type"];

function toCategory(row: { id: string; name: string; type: string; currency: string }): Category {
  return { id: row.id, name: row.name, type: row.type as CategoryType, currency: row.currency };
}

export async function getExpenseCategories(
  userId: string,
): Promise<Category[]> {
  const rows = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type, currency: accounts.currency })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.type, "expense")))
    .orderBy(asc(accounts.name));
  return rows.map(toCategory);
}

export async function getIncomeCategories(userId: string): Promise<Category[]> {
  const rows = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type, currency: accounts.currency })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.type, "income")))
    .orderBy(asc(accounts.name));
  return rows.map(toCategory);
}

export async function getCategoryByName(
  userId: string,
  name: string,
  type: CategoryType,
): Promise<Category | null> {
  const [row] = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type, currency: accounts.currency })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.name, name),
        eq(accounts.type, type),
      ),
    )
    .limit(1);
  if (!row) return null;
  return toCategory(row);
}

export async function createCategory(
  userId: string,
  name: string,
  type: CategoryType,
  currency: string,
): Promise<Category> {
  const account = await getOrCreateAccount(userId, name, type, currency);
  return toCategory(account);
}

export async function renameCategory(
  userId: string,
  categoryId: string,
  newName: string,
): Promise<Category> {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, categoryId),
        eq(accounts.userId, userId),
        or(eq(accounts.type, "expense"), eq(accounts.type, "income")),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Category not found");

  const [updated] = await db
    .update(accounts)
    .set({ name: newName })
    .where(and(eq(accounts.id, categoryId), eq(accounts.userId, userId)))
    .returning();

  return toCategory(updated);
}

export async function deleteCategory(
  userId: string,
  categoryId: string,
): Promise<void> {
  // Will fail with FK violation if any journal lines reference this category,
  // which is correct — the user must reassign those transactions first.
  await db
    .delete(accounts)
    .where(
      and(
        eq(accounts.id, categoryId),
        eq(accounts.userId, userId),
        or(eq(accounts.type, "expense"), eq(accounts.type, "income")),
      ),
    );
}

/**
 * Resolve a category name to an account row, creating it if it doesn't exist.
 * Used by AI tools to convert string category names to structured IDs.
 */
export async function resolveCategory(
  userId: string,
  name: string,
  type: CategoryType,
  currency: string,
  tx?: Tx,
): Promise<Category> {
  const account = await getOrCreateAccount(userId, name, type, currency, tx);
  return toCategory(account);
}

export interface CategoryWithTotal extends Category {
  total: number; // major units
  totalFormatted: string;
}

/**
 * Get all categories of a given type with their spending/income totals for a month.
 * Categories with zero activity in the period still appear with total = 0.
 * Month format: "YYYY-MM"
 */
export async function getCategoryTotals(
  userId: string,
  type: CategoryType,
  month: string,
  currency = "USD",
): Promise<CategoryWithTotal[]> {
  const [y, m] = month.split("-").map(Number);
  const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = new Date(y, m, 1);
  const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  // LEFT JOIN so categories with no activity in the period still appear (total = 0).
  // For expense categories: lines are debits (amount > 0).
  // For income categories: lines are credits (amount < 0) — we take ABS.
  const amountExpr =
    type === "expense"
      ? sql`COALESCE(SUM(jl.amount) FILTER (WHERE je.id IS NOT NULL AND jl.amount > 0), 0)`
      : sql`COALESCE(SUM(ABS(jl.amount)) FILTER (WHERE je.id IS NOT NULL AND jl.amount < 0), 0)`;

  const rows = await db.execute<{
    id: string;
    name: string;
    type: string;
    currency: string;
    total: string;
  }>(sql`
    SELECT
      a.id,
      a.name,
      a.type,
      a.currency,
      ${amountExpr}::text AS total
    FROM accounts a
    LEFT JOIN journal_lines jl
      ON jl.account_id = a.id
    LEFT JOIN journal_entries je
      ON jl.journal_entry_id = je.id
      AND je.date >= ${startDate}
      AND je.date < ${endDate}
    WHERE a.user_id = ${userId}
      AND a.type = ${type}
    GROUP BY a.id, a.name, a.type, a.currency
    ORDER BY total DESC
  `);

  return rows.map((row) => {
    const totalMinor = BigInt(row.total);
    return {
      ...toCategory(row),
      total: toMajorUnits(totalMinor, row.currency),
      totalFormatted: formatMoney(totalMinor, row.currency),
    };
  });
}
