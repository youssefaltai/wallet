/**
 * Goals service — savings goals backed by hidden asset accounts.
 *
 * Each goal has a dedicated backing account (type='asset') in the unified
 * accounts table. That account is excluded from getAccountsWithBalances so
 * it never appears in the user's regular account list.
 *
 * The goal's backing account uses the user's base currency at creation time.
 * Funding from a different-currency account is a cross-currency transfer.
 *
 * Balances are computed on the fly from journal_lines — nothing is stored.
 */

import { db } from "@/lib/db";
import { goals, accounts, journalEntries, journalLines } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { getAccountBalances, createJournalEntry, type Tx } from "./ledger";
import { toMinorUnits, toMajorUnits, formatMoney } from "./money";
import { getRates, convert } from "./fx-rates";

// ── Create ────────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  userId: string;
  name: string;
  targetAmount: number; // major units
  deadline?: string;
  notes?: string;
  currency?: string; // user's base currency — used for the backing account
}

export async function createGoal(input: CreateGoalInput) {
  const goalCurrency = input.currency ?? "USD";

  return db.transaction(async (tx: Tx) => {
    // Create a hidden backing account for this goal
    const [account] = await tx
      .insert(accounts)
      .values({
        userId: input.userId,
        name: `Goal: ${input.name}`,
        type: "asset",
        currency: goalCurrency,
      })
      .returning();

    const [goal] = await tx
      .insert(goals)
      .values({
        userId: input.userId,
        accountId: account.id,
        name: input.name,
        targetAmount: toMinorUnits(input.targetAmount, goalCurrency),
        deadline: input.deadline ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    return formatGoal(goal, 0n, goalCurrency);
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
    notes?: string;
  },
) {
  // Fetch goal + backing account to get the goal's currency
  const [existing] = await db
    .select({ goal: goals, accountCurrency: accounts.currency })
    .from(goals)
    .innerJoin(accounts, eq(goals.accountId, accounts.id))
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);
  if (!existing) throw new Error("Goal not found");

  const goalCurrency = existing.accountCurrency;

  const values: Partial<typeof goals.$inferInsert> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.targetAmount !== undefined)
    values.targetAmount = toMinorUnits(updates.targetAmount, goalCurrency);
  if (updates.deadline !== undefined) values.deadline = updates.deadline;
  if (updates.notes !== undefined) values.notes = updates.notes;

  const [updated] = await db
    .update(goals)
    .set(values)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning();

  if (!updated) throw new Error("Goal not found");

  const balances = await getAccountBalances([updated.accountId]);
  return formatGoal(updated, balances.get(updated.accountId) ?? 0n, goalCurrency);
}

// ── Read ──────────────────────────────────────────────────────────────────

export interface GoalWithProgress {
  id: string;
  name: string;
  accountId: string;
  currency: string;
  targetAmount: number;
  targetAmountFormatted: string;
  currentAmount: number;
  currentAmountFormatted: string;
  progressPercent: number;
  deadline: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface GoalFilters {
  /** Only show completed goals whose deadline falls in this month (YYYY-MM). */
  deadlineMonth?: string;
}

export async function getGoals(
  userId: string,
  filters?: GoalFilters,
): Promise<GoalWithProgress[]> {
  const rows = await db
    .select({ goal: goals, accountCurrency: accounts.currency })
    .from(goals)
    .innerJoin(accounts, eq(goals.accountId, accounts.id))
    .where(eq(goals.userId, userId))
    .orderBy(goals.createdAt);

  // Filter completed goals by deadline month if specified
  const filtered = filters?.deadlineMonth
    ? rows.filter((r) => {
        if (!r.goal.deadline) return true;
        return r.goal.deadline.startsWith(filters.deadlineMonth!);
      })
    : rows;

  if (filtered.length === 0) return [];

  const balances = await getAccountBalances(filtered.map((r) => r.goal.accountId));
  return filtered.map((r) =>
    formatGoal(r.goal, balances.get(r.goal.accountId) ?? 0n, r.accountCurrency),
  );
}

export async function getGoalById(
  goalId: string,
  userId: string,
): Promise<GoalWithProgress | null> {
  const [row] = await db
    .select({ goal: goals, accountCurrency: accounts.currency })
    .from(goals)
    .innerJoin(accounts, eq(goals.accountId, accounts.id))
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (!row) return null;

  const balances = await getAccountBalances([row.goal.accountId]);
  return formatGoal(row.goal, balances.get(row.goal.accountId) ?? 0n, row.accountCurrency);
}

/**
 * Total balance across all goal accounts, converted to baseCurrency.
 * Used for net worth calculation.
 */
export async function getGoalsTotalBalance(
  userId: string,
  baseCurrency = "USD",
): Promise<number> {
  const rows = await db
    .select({ accountId: goals.accountId, currency: accounts.currency })
    .from(goals)
    .innerJoin(accounts, eq(goals.accountId, accounts.id))
    .where(eq(goals.userId, userId));

  if (rows.length === 0) return 0;

  const balances = await getAccountBalances(rows.map((r) => r.accountId));

  const needsConversion = rows.some((r) => r.currency !== baseCurrency);
  const rates = needsConversion ? await getRates() : null;

  let total = 0;
  for (const row of rows) {
    const balance = balances.get(row.accountId) ?? 0n;
    const major = toMajorUnits(balance, row.currency);
    if (row.currency === baseCurrency) {
      total += major;
    } else {
      total += convert(major, row.currency, baseCurrency, rates!);
    }
  }
  return total;
}

// ── Internal balance check ────────────────────────────────────────────────

/**
 * Query the current balance of an account within the given transaction context.
 * Returns the net sum of all journal_lines.amount for that account (minor units).
 * For asset accounts: positive = funds available.
 *
 * Acquires a row-level lock on the account row (SELECT FOR UPDATE) before reading
 * the balance, serializing concurrent check-then-debit operations and preventing
 * TOCTOU races under PostgreSQL READ COMMITTED.
 */
async function getBalanceInTx(tx: Tx, accountId: string): Promise<bigint> {
  // Lock the account row to prevent concurrent transactions from racing on the
  // same account. PostgreSQL does not allow FOR UPDATE on aggregate queries, so
  // we lock the account row separately, then compute the balance.
  await tx.execute(sql`SELECT id FROM accounts WHERE id = ${accountId} FOR UPDATE`);

  const [row] = await tx
    .select({ balance: sql<string>`COALESCE(SUM(${journalLines.amount}), 0)` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(and(eq(journalLines.accountId, accountId), isNull(journalEntries.deletedAt)));
  return BigInt(row?.balance ?? "0");
}

// ── Fund / Withdraw ───────────────────────────────────────────────────────

/**
 * Transfer money from a user account into a goal.
 * If the source account has a different currency than the goal,
 * this is a cross-currency transfer.
 */
export async function fundGoal(
  goalId: string,
  userId: string,
  sourceAccountId: string,
  amount: number, // major units in source account's currency, positive
  date: string,
  creditAmount?: number, // major units in goal's currency — for cross-currency
  exchangeRate?: number, // source currency → goal currency conversion rate
  idempotencyKey?: string,
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  return db.transaction(async (tx: Tx) => {
    const [goal] = await tx
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    // Get both accounts with currencies
    const [srcAccount] = await tx
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, sourceAccountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!srcAccount) throw new Error("Source account not found");

    const [goalAccount] = await tx
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, goal.accountId))
      .limit(1);
    if (!goalAccount) throw new Error("Goal account not found");

    const srcCurrency = srcAccount.currency;
    const goalCurrency = goalAccount.currency;

    let srcMinor: bigint;
    let goalMinor: bigint;

    if (srcCurrency === goalCurrency) {
      // Same currency — straightforward
      srcMinor = toMinorUnits(amount, srcCurrency);
      goalMinor = srcMinor;
    } else {
      // Cross-currency: apply 2-of-3 resolution (amount, creditAmount, exchangeRate)
      const hasAmount = amount > 0;
      const hasCreditAmount = creditAmount !== undefined && creditAmount > 0;
      const hasRate = exchangeRate !== undefined && exchangeRate > 0;

      let resolvedAmount = hasAmount ? Math.abs(amount) : 0;
      let resolvedCreditAmount = hasCreditAmount ? Math.abs(creditAmount!) : 0;

      if (hasAmount && hasCreditAmount) {
        // Both amounts provided — use them directly (ignore rate if present)
      } else if (hasAmount && hasRate) {
        // Compute creditAmount from amount * exchangeRate
        resolvedCreditAmount = resolvedAmount * exchangeRate!;
      } else if (hasCreditAmount && hasRate) {
        // Compute amount from creditAmount / exchangeRate
        resolvedAmount = resolvedCreditAmount / exchangeRate!;
      } else {
        throw new Error(
          "Cross-currency goal funding requires at least two of: amount, creditAmount, exchangeRate. " +
          `Source account uses ${srcCurrency}, goal uses ${goalCurrency}. ` +
          "Provide any two of: amount (source currency) + creditAmount (goal currency), " +
          "amount + exchangeRate, or creditAmount + exchangeRate.",
        );
      }

      srcMinor = toMinorUnits(resolvedAmount, srcCurrency);
      goalMinor = toMinorUnits(resolvedCreditAmount, goalCurrency);
    }

    // Overdraft check: ensure source account has sufficient balance (in its own currency)
    const srcBalance = await getBalanceInTx(tx, sourceAccountId);
    if (srcBalance - srcMinor < 0n) {
      throw new Error(
        `Insufficient balance in source account. Available: ${formatMoney(srcBalance < 0n ? 0n : srcBalance, srcCurrency)}, required: ${formatMoney(srcMinor, srcCurrency)}.`,
      );
    }

    await createJournalEntry(
      userId,
      date,
      `Fund goal: ${goal.name}`,
      null,
      [
        { accountId: goal.accountId, amount: goalMinor, currency: goalCurrency }, // debit goal
        { accountId: sourceAccountId, amount: -srcMinor, currency: srcCurrency }, // credit source
      ],
      tx,
      idempotencyKey,
    );

    const balances = await getAccountBalances([goal.accountId]);
    return formatGoal(goal, balances.get(goal.accountId) ?? 0n, goalCurrency);
  });
}

/**
 * Withdraw money from a goal back to a user account.
 * If the destination account has a different currency than the goal,
 * this is a cross-currency transfer.
 */
export async function withdrawFromGoal(
  goalId: string,
  userId: string,
  destinationAccountId: string,
  amount: number, // major units in goal's currency, positive
  date: string,
  creditAmount?: number, // major units in destination's currency — for cross-currency
  exchangeRate?: number, // goal currency → destination currency conversion rate
  idempotencyKey?: string,
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  return db.transaction(async (tx: Tx) => {
    const [goal] = await tx
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    const [dstAccount] = await tx
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(
        and(eq(accounts.id, destinationAccountId), eq(accounts.userId, userId)),
      )
      .limit(1);
    if (!dstAccount) throw new Error("Destination account not found");

    const [goalAccount] = await tx
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, goal.accountId))
      .limit(1);
    if (!goalAccount) throw new Error("Goal account not found");

    const goalCurrency = goalAccount.currency;
    const dstCurrency = dstAccount.currency;

    let goalMinor: bigint;
    let dstMinor: bigint;

    if (goalCurrency === dstCurrency) {
      // Same currency — straightforward
      goalMinor = toMinorUnits(amount, goalCurrency);
      dstMinor = goalMinor;
    } else {
      // Cross-currency: apply 2-of-3 resolution (amount, creditAmount, exchangeRate)
      const hasAmount = amount > 0;
      const hasCreditAmount = creditAmount !== undefined && creditAmount > 0;
      const hasRate = exchangeRate !== undefined && exchangeRate > 0;

      let resolvedAmount = hasAmount ? Math.abs(amount) : 0;
      let resolvedCreditAmount = hasCreditAmount ? Math.abs(creditAmount!) : 0;

      if (hasAmount && hasCreditAmount) {
        // Both amounts provided — use them directly (ignore rate if present)
      } else if (hasAmount && hasRate) {
        // Compute creditAmount from amount * exchangeRate
        resolvedCreditAmount = resolvedAmount * exchangeRate!;
      } else if (hasCreditAmount && hasRate) {
        // Compute amount from creditAmount / exchangeRate
        resolvedAmount = resolvedCreditAmount / exchangeRate!;
      } else {
        throw new Error(
          "Cross-currency goal withdrawal requires at least two of: amount, creditAmount, exchangeRate. " +
          `Goal uses ${goalCurrency}, destination account uses ${dstCurrency}. ` +
          "Provide any two of: amount (goal currency) + creditAmount (destination currency), " +
          "amount + exchangeRate, or creditAmount + exchangeRate.",
        );
      }

      goalMinor = toMinorUnits(resolvedAmount, goalCurrency);
      dstMinor = toMinorUnits(resolvedCreditAmount, dstCurrency);
    }

    // Overdraft check: ensure goal account has sufficient balance (in its own currency)
    const goalBalance = await getBalanceInTx(tx, goal.accountId);
    if (goalBalance - goalMinor < 0n) {
      throw new Error(
        `Insufficient balance in goal. Available: ${formatMoney(goalBalance < 0n ? 0n : goalBalance, goalCurrency)}, required: ${formatMoney(goalMinor, goalCurrency)}.`,
      );
    }

    await createJournalEntry(
      userId,
      date,
      `Withdraw from goal: ${goal.name}`,
      null,
      [
        { accountId: destinationAccountId, amount: dstMinor, currency: dstCurrency }, // debit destination
        { accountId: goal.accountId, amount: -goalMinor, currency: goalCurrency }, // credit goal
      ],
      tx,
      idempotencyKey,
    );

    const balances = await getAccountBalances([goal.accountId]);
    return formatGoal(goal, balances.get(goal.accountId) ?? 0n, goalCurrency);
  });
}

// ── Delete ────────────────────────────────────────────────────────────────

/**
 * Delete a goal and its backing account.
 * Refused if the goal has any associated transactions (journal lines on its backing account).
 * The caller should withdraw all funds first before deleting.
 */
export async function deleteGoal(goalId: string, userId: string): Promise<void> {
  return db.transaction(async (tx: Tx) => {
    const [existing] = await tx
      .select({ accountId: goals.accountId })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!existing) throw new Error("Goal not found");

    const [line] = await tx
      .select({ journalEntryId: journalLines.journalEntryId })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(eq(journalLines.accountId, existing.accountId), isNull(journalEntries.deletedAt)))
      .limit(1);

    if (line) {
      throw new Error(
        "Cannot delete a goal that has transactions. Withdraw all funds first, then delete.",
      );
    }

    // Delete backing account — cascades to goal row
    await tx.delete(accounts).where(eq(accounts.id, existing.accountId));
  });
}

// ── Batch ────────────────────────────────────────────────────────────────

export interface BatchFundGoalItem {
  goalId: string;
  sourceAccountId: string;
  amount: number; // major units, positive — in source account's currency
  creditAmount?: number; // major units in goal's currency — for cross-currency
  exchangeRate?: number; // source currency → goal currency conversion rate
  date: string;
  idempotencyKey?: string;
}

/**
 * Fund multiple goals in a single DB transaction (all-or-nothing).
 * Returns total amount funded.
 */
export async function batchFundGoals(
  userId: string,
  items: BatchFundGoalItem[],
): Promise<{ count: number }> {
  if (items.length === 0) throw new Error("No items to process");
  if (items.length > 20) throw new Error("Maximum 20 items per batch");

  return db.transaction(async (tx: Tx) => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (item.amount <= 0) throw new Error("Amount must be positive");

        const [goal] = await tx
          .select()
          .from(goals)
          .where(and(eq(goals.id, item.goalId), eq(goals.userId, userId)))
          .limit(1);
        if (!goal) throw new Error("Goal not found");

        const [srcAccount] = await tx
          .select({ id: accounts.id, currency: accounts.currency })
          .from(accounts)
          .where(and(eq(accounts.id, item.sourceAccountId), eq(accounts.userId, userId)))
          .limit(1);
        if (!srcAccount) throw new Error("Source account not found");

        const [goalAccount] = await tx
          .select({ id: accounts.id, currency: accounts.currency })
          .from(accounts)
          .where(eq(accounts.id, goal.accountId))
          .limit(1);
        if (!goalAccount) throw new Error("Goal account not found");

        const srcCurrency = srcAccount.currency;
        const goalCurrency = goalAccount.currency;

        let srcMinor: bigint;
        let goalMinor: bigint;

        if (srcCurrency === goalCurrency) {
          srcMinor = toMinorUnits(item.amount, srcCurrency);
          goalMinor = srcMinor;
        } else {
          // Cross-currency: require explicit 2-of-3 resolution — no silent FX lookups
          const hasAmount = item.amount > 0;
          const hasCreditAmount = item.creditAmount !== undefined && item.creditAmount > 0;
          const hasRate = item.exchangeRate !== undefined && item.exchangeRate > 0;

          let resolvedAmount = item.amount;
          let resolvedCreditAmount = item.creditAmount ?? 0;

          if (hasAmount && hasCreditAmount) {
            // Both amounts provided — use them directly
          } else if (hasAmount && hasRate) {
            resolvedCreditAmount = resolvedAmount * item.exchangeRate!;
          } else if (hasCreditAmount && hasRate) {
            resolvedAmount = resolvedCreditAmount / item.exchangeRate!;
          } else {
            throw new Error(
              `Cross-currency goal funding requires at least two of: amount, creditAmount, exchangeRate. ` +
              `Source account uses ${srcCurrency}, goal uses ${goalCurrency}. ` +
              `Provide any two of: amount (${srcCurrency}) + creditAmount (${goalCurrency}), ` +
              `amount + exchangeRate, or creditAmount + exchangeRate.`,
            );
          }

          srcMinor = toMinorUnits(resolvedAmount, srcCurrency);
          goalMinor = toMinorUnits(resolvedCreditAmount, goalCurrency);
        }

        // Overdraft check: ensure source account has sufficient balance (in its own currency)
        const srcBalance = await getBalanceInTx(tx, item.sourceAccountId);
        if (srcBalance - srcMinor < 0n) {
          throw new Error(
            `Insufficient balance in source account. Available: ${formatMoney(srcBalance < 0n ? 0n : srcBalance, srcCurrency)}, required: ${formatMoney(srcMinor, srcCurrency)}.`,
          );
        }

        await createJournalEntry(
          userId,
          item.date,
          `Fund goal: ${goal.name}`,
          null,
          [
            { accountId: goal.accountId, amount: goalMinor, currency: goalCurrency },
            { accountId: item.sourceAccountId, amount: -srcMinor, currency: srcCurrency },
          ],
          tx,
          item.idempotencyKey,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Operation failed";
        throw new Error(`Item ${i}: ${msg}`);
      }
    }

    return { count: items.length };
  });
}

/**
 * Create multiple goals in a single DB transaction (all-or-nothing).
 */
export async function batchCreateGoals(
  inputs: CreateGoalInput[],
): Promise<{ count: number }> {
  if (inputs.length === 0) throw new Error("No goals to create");
  if (inputs.length > 20) throw new Error("Maximum 20 goals per batch");

  return db.transaction(async (tx: Tx) => {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      try {
        const goalCurrency = input.currency ?? "USD";

        const [account] = await tx
          .insert(accounts)
          .values({
            userId: input.userId,
            name: `Goal: ${input.name}`,
            type: "asset",
            currency: goalCurrency,
          })
          .returning();

        await tx.insert(goals).values({
          userId: input.userId,
          accountId: account.id,
          name: input.name,
          targetAmount: toMinorUnits(input.targetAmount, goalCurrency),
          deadline: input.deadline ?? null,
          notes: input.notes ?? null,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Operation failed";
        if (msg.startsWith("Item ")) throw error;
        throw new Error(`Item ${i}: ${msg}`);
      }
    }

    return { count: inputs.length };
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
    currency,
    targetAmount: toMajorUnits(targetMinor, currency),
    targetAmountFormatted: formatMoney(targetMinor, currency),
    currentAmount: toMajorUnits(balance, currency),
    currentAmountFormatted: formatMoney(balance, currency),
    progressPercent,
    deadline: goal.deadline,
    notes: goal.notes,
    createdAt: goal.createdAt,
  };
}
