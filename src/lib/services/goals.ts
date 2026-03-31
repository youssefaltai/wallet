/**
 * Goals service — savings goals backed by hidden asset accounts.
 *
 * Each goal has a dedicated backing account (type='asset') in the unified
 * accounts table. That account is excluded from getAccountsWithBalances so
 * it never appears in the user's regular account list.
 *
 * Balances are computed on the fly from journal_lines — nothing is stored.
 */

import { db } from "@/lib/db";
import { goals, accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAccountBalances, createJournalEntry, type Tx } from "./ledger";
import { toMinorUnits, toMajorUnits, formatMoney } from "./money";

// ── Create ────────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  userId: string;
  name: string;
  targetAmount: number; // major units
  deadline?: string;
  notes?: string;
  currency?: string;
}

export async function createGoal(input: CreateGoalInput) {
  return db.transaction(async (tx: Tx) => {
    // Create a hidden backing account for this goal
    const [account] = await tx
      .insert(accounts)
      .values({
        userId: input.userId,
        name: `Goal: ${input.name}`,
        type: "asset",
      })
      .returning();

    const [goal] = await tx
      .insert(goals)
      .values({
        userId: input.userId,
        accountId: account.id,
        name: input.name,
        targetAmount: toMinorUnits(input.targetAmount),
        deadline: input.deadline ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    return formatGoal(goal, 0n, input.currency);
  });
}

// ── Update ────────────────────────────────────────────────────────────────

export async function updateGoal(
  goalId: string,
  userId: string,
  updates: {
    name?: string;
    targetAmount?: number;
    deadline?: string;
    status?: string;
    notes?: string;
  },
  currency = "USD",
) {
  const values: Partial<typeof goals.$inferInsert> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.targetAmount !== undefined)
    values.targetAmount = toMinorUnits(updates.targetAmount);
  if (updates.deadline !== undefined) values.deadline = updates.deadline;
  if (updates.status !== undefined) values.status = updates.status;
  if (updates.notes !== undefined) values.notes = updates.notes;

  const [updated] = await db
    .update(goals)
    .set(values)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning();

  if (!updated) throw new Error("Goal not found");

  const balances = await getAccountBalances([updated.accountId]);
  return formatGoal(updated, balances.get(updated.accountId) ?? 0n, currency);
}

// ── Read ──────────────────────────────────────────────────────────────────

export interface GoalWithProgress {
  id: string;
  name: string;
  accountId: string;
  targetAmount: number;
  targetAmountFormatted: string;
  currentAmount: number;
  currentAmountFormatted: string;
  progressPercent: number;
  deadline: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
}

export interface GoalFilters {
  /** Only show completed goals whose deadline falls in this month (YYYY-MM). Active/paused always included. */
  deadlineMonth?: string;
  status?: string;
  currency?: string;
}

export async function getGoals(
  userId: string,
  filters?: GoalFilters,
): Promise<GoalWithProgress[]> {
  const conditions = [eq(goals.userId, userId)];
  if (filters?.status) conditions.push(eq(goals.status, filters.status));

  const rows = await db
    .select()
    .from(goals)
    .where(and(...conditions))
    .orderBy(goals.createdAt);

  // Active/paused goals always show. Completed goals only show in their deadline month.
  const filtered = filters?.deadlineMonth
    ? rows.filter((g) => {
        if (g.status !== "completed") return true;
        if (!g.deadline) return true;
        return g.deadline.startsWith(filters.deadlineMonth!);
      })
    : rows;

  if (filtered.length === 0) return [];

  const currency = filters?.currency ?? "USD";
  const balances = await getAccountBalances(filtered.map((g) => g.accountId));
  return filtered.map((g) => formatGoal(g, balances.get(g.accountId) ?? 0n, currency));
}

export async function getGoalById(
  goalId: string,
  userId: string,
  currency = "USD",
): Promise<GoalWithProgress | null> {
  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (!goal) return null;

  const balances = await getAccountBalances([goal.accountId]);
  return formatGoal(goal, balances.get(goal.accountId) ?? 0n, currency);
}

/** Total balance across all goal accounts in major units. Used for net worth. */
export async function getGoalsTotalBalance(userId: string): Promise<number> {
  const rows = await db
    .select({ accountId: goals.accountId })
    .from(goals)
    .where(eq(goals.userId, userId));

  if (rows.length === 0) return 0;

  const balances = await getAccountBalances(rows.map((r) => r.accountId));
  let total = 0n;
  for (const b of balances.values()) total += b;
  return toMajorUnits(total);
}

// ── Fund / Withdraw ───────────────────────────────────────────────────────

/**
 * Transfer money from a user account into a goal.
 * Journal entry: debit goal account (money arrives), credit source account (money leaves).
 */
export async function fundGoal(
  goalId: string,
  userId: string,
  sourceAccountId: string,
  amount: number, // major units, positive
  date: string,
  currency = "USD",
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  return db.transaction(async (tx: Tx) => {
    const [goal] = await tx
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    // Verify the source account belongs to this user
    const [srcAccount] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, sourceAccountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!srcAccount) throw new Error("Source account not found");

    const minorAmount = toMinorUnits(amount);

    await createJournalEntry(
      userId,
      date,
      `Fund goal: ${goal.name}`,
      null,
      [
        { accountId: goal.accountId, amount: minorAmount }, // debit goal
        { accountId: sourceAccountId, amount: -minorAmount }, // credit source
      ],
      tx,
    );

    const balances = await getAccountBalances([goal.accountId]);
    return formatGoal(goal, balances.get(goal.accountId) ?? 0n, currency);
  });
}

/**
 * Withdraw money from a goal back to a user account.
 * Journal entry: debit destination account (money arrives), credit goal account (money leaves).
 */
export async function withdrawFromGoal(
  goalId: string,
  userId: string,
  destinationAccountId: string,
  amount: number, // major units, positive
  date: string,
  currency = "USD",
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  return db.transaction(async (tx: Tx) => {
    const [goal] = await tx
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    // Verify the destination account belongs to this user
    const [dstAccount] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.id, destinationAccountId), eq(accounts.userId, userId)),
      )
      .limit(1);
    if (!dstAccount) throw new Error("Destination account not found");

    const minorAmount = toMinorUnits(amount);

    await createJournalEntry(
      userId,
      date,
      `Withdraw from goal: ${goal.name}`,
      null,
      [
        { accountId: destinationAccountId, amount: minorAmount }, // debit destination
        { accountId: goal.accountId, amount: -minorAmount }, // credit goal
      ],
      tx,
    );

    const balances = await getAccountBalances([goal.accountId]);
    return formatGoal(goal, balances.get(goal.accountId) ?? 0n, currency);
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────

type GoalRow = typeof goals.$inferSelect;

function formatGoal(goal: GoalRow, balance: bigint, currency = "USD"): GoalWithProgress {
  const targetMinor = goal.targetAmount;
  const progressPercent =
    targetMinor > 0n
      ? Math.min(100, Math.round((Number(balance) / Number(targetMinor)) * 100))
      : 0;

  return {
    id: goal.id,
    name: goal.name,
    accountId: goal.accountId,
    targetAmount: toMajorUnits(targetMinor),
    targetAmountFormatted: formatMoney(targetMinor, currency),
    currentAmount: toMajorUnits(balance),
    currentAmountFormatted: formatMoney(balance, currency),
    progressPercent,
    deadline: goal.deadline,
    status: goal.status,
    notes: goal.notes,
    createdAt: goal.createdAt,
  };
}
