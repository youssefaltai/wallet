/**
 * Transaction service.
 *
 * "Transactions" are what users and the AI call financial events.
 * Internally they are journal_entries with balanced journal_lines.
 *
 * Type inference (from line account types):
 *   - any debit  line has type='expense'  → expense
 *   - any credit line has type='income'   → income
 *   - otherwise                           → transfer
 *
 * User/AI never see debit, credit, journal, or ledger terminology.
 */

import { db } from "@/lib/db";
import { journalEntries, journalLines, accounts } from "@/lib/db/schema";
import { eq, and, sql, inArray, type SQL } from "drizzle-orm";
import { createJournalEntry, deleteJournalEntry } from "./ledger";
import { toMinorUnits, toMajorUnits, formatMoney } from "./money";

// ── Types ────────────────────────────────────────────────────────────────

export type TransactionType = "expense" | "income" | "transfer";

export interface CreateTransactionInput {
  userId: string;
  debitAccountId: string; // unified accounts.id — account being debited
  creditAccountId: string; // unified accounts.id — account being credited
  amount: number; // major units, always positive
  description?: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  currency?: string;
}

export interface UpdateTransactionInput {
  description?: string;
  debitAccountId?: string; // unified accounts.id
  creditAccountId?: string; // unified accounts.id
  notes?: string;
}

export interface TransactionFilters {
  userId: string;
  /** Filter to entries that have a line touching this account (asset/liability) */
  accountId?: string;
  /** Filter to entries that have a line touching this category (expense/income) */
  categoryAccountId?: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  currency?: string;
}

export interface TransactionRow {
  id: string; // journal_entry.id
  type: TransactionType;
  accountId: string; // the asset/liability account involved
  accountName: string;
  categoryName: string | null; // expense category or income source; null for transfers
  categoryAccountId: string | null;
  amount: number; // major units, always positive
  amountFormatted: string;
  signedAmountFormatted: string; // "-$52.30" for expenses, "$52.30" otherwise
  description: string | null;
  date: string;
  notes: string | null;
  createdAt: Date;
  transferAccountName: string | null; // destination account name for transfers
}

// ── Helpers ──────────────────────────────────────────────────────────────

function inferType(
  debitTypes: string[],
  creditTypes: string[],
): TransactionType {
  if (debitTypes.some((t) => t === "expense")) return "expense";
  if (creditTypes.some((t) => t === "income")) return "income";
  return "transfer";
}

function buildConditions(
  filters: Omit<TransactionFilters, "limit" | "offset">,
): SQL[] {
  const c: SQL[] = [sql`je.user_id = ${filters.userId}`];

  if (filters.startDate && filters.endDate) {
    c.push(sql`je.date BETWEEN ${filters.startDate} AND ${filters.endDate}`);
  } else if (filters.startDate) {
    c.push(sql`je.date >= ${filters.startDate}`);
  } else if (filters.endDate) {
    c.push(sql`je.date <= ${filters.endDate}`);
  }

  if (filters.search) {
    c.push(sql`je.description ILIKE ${`%${filters.search}%`}`);
  }

  if (filters.accountId) {
    c.push(sql`
      EXISTS (
        SELECT 1 FROM journal_lines jla
        WHERE jla.journal_entry_id = je.id
          AND jla.account_id = ${filters.accountId}
      )
    `);
  }

  if (filters.categoryAccountId) {
    c.push(sql`
      EXISTS (
        SELECT 1 FROM journal_lines jlc
        WHERE jlc.journal_entry_id = je.id
          AND jlc.account_id = ${filters.categoryAccountId}
      )
    `);
  }

  if (filters.type === "expense") {
    c.push(sql`
      EXISTS (
        SELECT 1 FROM journal_lines jlt
        JOIN accounts at ON jlt.account_id = at.id
        WHERE jlt.journal_entry_id = je.id
          AND at.type = 'expense'
          AND jlt.amount > 0
      )
    `);
  } else if (filters.type === "income") {
    c.push(sql`
      EXISTS (
        SELECT 1 FROM journal_lines jlt
        JOIN accounts at ON jlt.account_id = at.id
        WHERE jlt.journal_entry_id = je.id
          AND at.type = 'income'
          AND jlt.amount < 0
      )
    `);
  } else if (filters.type === "transfer") {
    c.push(sql`
      NOT EXISTS (
        SELECT 1 FROM journal_lines jlt
        JOIN accounts at ON jlt.account_id = at.id
        WHERE jlt.journal_entry_id = je.id
          AND at.type IN ('expense', 'income')
      )
    `);
  }

  return c;
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function createTransaction(input: CreateTransactionInput) {
  // Verify both accounts belong to the user
  const accountIds = [input.debitAccountId, input.creditAccountId];
  const owned = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), inArray(accounts.id, accountIds)));
  if (owned.length < new Set(accountIds).size) {
    throw new Error("Account not found");
  }

  const minorAmount = toMinorUnits(Math.abs(input.amount));

  const entry = await createJournalEntry(
    input.userId,
    input.date,
    input.description ?? null,
    input.notes ?? null,
    [
      { accountId: input.debitAccountId, amount: minorAmount },
      { accountId: input.creditAccountId, amount: -minorAmount },
    ],
  );

  const currency = input.currency ?? "USD";

  return {
    id: entry.id,
    date: entry.date,
    description: entry.description,
    notes: entry.notes,
    amount: toMajorUnits(minorAmount),
    amountFormatted: formatMoney(minorAmount, currency),
  };
}

export async function deleteTransaction(transactionId: string, userId: string) {
  // transactionId IS the journal_entry_id — no lookup step needed
  await deleteJournalEntry(transactionId, userId);
}

export async function updateTransaction(
  transactionId: string,
  userId: string,
  updates: UpdateTransactionInput,
) {
  return db.transaction(async (tx) => {
    // 1. Update journal entry metadata if anything changed
    const entryUpdates: Partial<typeof journalEntries.$inferInsert> = {};
    if (updates.description !== undefined)
      entryUpdates.description = updates.description;
    if (updates.notes !== undefined) entryUpdates.notes = updates.notes;

    let entry;
    if (Object.keys(entryUpdates).length > 0) {
      const [updated] = await tx
        .update(journalEntries)
        .set(entryUpdates)
        .where(
          and(
            eq(journalEntries.id, transactionId),
            eq(journalEntries.userId, userId),
          ),
        )
        .returning();
      if (!updated) throw new Error("Transaction not found");
      entry = updated;
    } else {
      const [existing] = await tx
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.id, transactionId),
            eq(journalEntries.userId, userId),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("Transaction not found");
      entry = existing;
    }

    // 2. Swap the debit line's account (positive amount = debit)
    if (updates.debitAccountId !== undefined) {
      await tx
        .update(journalLines)
        .set({ accountId: updates.debitAccountId })
        .where(
          and(
            eq(journalLines.journalEntryId, transactionId),
            sql`${journalLines.amount} > 0`,
          ),
        );
    }

    // 3. Swap the credit line's account (negative amount = credit)
    if (updates.creditAccountId !== undefined) {
      await tx
        .update(journalLines)
        .set({ accountId: updates.creditAccountId })
        .where(
          and(
            eq(journalLines.journalEntryId, transactionId),
            sql`${journalLines.amount} < 0`,
          ),
        );
    }

    return { id: entry.id };
  });
}

// ── Query ─────────────────────────────────────────────────────────────────

export async function getTransactions(
  filters: TransactionFilters,
): Promise<TransactionRow[]> {
  const currency = filters.currency ?? "USD";
  const whereClause = sql.join(buildConditions(filters), sql` AND `);
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // CTE selects the page of matching entries; the outer query joins their lines
  // and accounts in a single round-trip so we can group in TypeScript.
  const rows = await db.execute<{
    id: string;
    date: string;
    description: string | null;
    notes: string | null;
    created_at: string;
    account_id: string;
    line_amount: string;
    account_name: string;
    account_type: string;
  }>(sql`
    WITH matching_entries AS (
      SELECT je.id, je.date, je.created_at
      FROM journal_entries je
      WHERE ${whereClause}
      ORDER BY je.date DESC, je.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    )
    SELECT
      je.id,
      je.date::text,
      je.description,
      je.notes,
      je.created_at::text,
      jl.account_id,
      jl.amount::text  AS line_amount,
      a.name           AS account_name,
      a.type           AS account_type
    FROM matching_entries me
    JOIN journal_entries je ON je.id = me.id
    JOIN journal_lines  jl ON jl.journal_entry_id = je.id
    JOIN accounts       a  ON a.id = jl.account_id
    ORDER BY je.date DESC, je.created_at DESC, je.id, jl.amount DESC
  `);

  // ── Group by journal entry ───────────────────────────────────────────
  type LineInfo = {
    accountId: string;
    amount: bigint;
    name: string;
    type: string;
  };
  type EntryAcc = {
    id: string;
    date: string;
    description: string | null;
    notes: string | null;
    createdAt: Date;
    lines: LineInfo[];
  };

  const entryMap = new Map<string, EntryAcc>();
  const entryOrder: string[] = [];

  for (const row of rows) {
    if (!entryMap.has(row.id)) {
      entryMap.set(row.id, {
        id: row.id,
        date: row.date,
        description: row.description,
        notes: row.notes,
        createdAt: new Date(row.created_at),
        lines: [],
      });
      entryOrder.push(row.id);
    }
    entryMap.get(row.id)!.lines.push({
      accountId: row.account_id,
      amount: BigInt(row.line_amount),
      name: row.account_name,
      type: row.account_type,
    });
  }

  // ── Build one TransactionRow per entry ──────────────────────────────
  const result: TransactionRow[] = [];

  for (const entryId of entryOrder) {
    const entry = entryMap.get(entryId)!;
    const debitLines = entry.lines.filter((l) => l.amount > 0n);
    const creditLines = entry.lines.filter((l) => l.amount < 0n);

    const type = inferType(
      debitLines.map((l) => l.type),
      creditLines.map((l) => l.type),
    );

    const totalMinor = debitLines.reduce((s, l) => s + l.amount, 0n);
    const amount = toMajorUnits(totalMinor);
    const amountFormatted = formatMoney(totalMinor, currency);

    let accountId: string;
    let accountName: string;
    let categoryName: string | null = null;
    let categoryAccountId: string | null = null;
    let transferAccountName: string | null = null;
    let signedAmountFormatted: string;

    switch (type) {
      case "expense": {
        // real account = credit side (money left here)
        const acctLine =
          creditLines.find(
            (l) => l.type === "asset" || l.type === "liability",
          ) ?? creditLines[0];
        // primary category = largest expense debit
        const catLine =
          debitLines
            .filter((l) => l.type === "expense")
            .sort((a, b) => Number(b.amount - a.amount))[0] ?? debitLines[0];
        accountId = acctLine.accountId;
        accountName = acctLine.name;
        categoryName = catLine.name;
        categoryAccountId = catLine.accountId;
        signedAmountFormatted = `-${amountFormatted}`;
        break;
      }
      case "income": {
        // real account = debit side (money arrived here)
        const acctLine =
          debitLines.find(
            (l) => l.type === "asset" || l.type === "liability",
          ) ?? debitLines[0];
        // primary category = largest income credit (most negative)
        const catLine =
          creditLines
            .filter((l) => l.type === "income")
            .sort((a, b) => Number(a.amount - b.amount))[0] ?? creditLines[0];
        accountId = acctLine.accountId;
        accountName = acctLine.name;
        categoryName = catLine.name;
        categoryAccountId = catLine.accountId;
        signedAmountFormatted = amountFormatted;
        break;
      }
      case "transfer": {
        // source = credit side (money left), destination = debit side (money arrived)
        const srcLine =
          creditLines.find(
            (l) => l.type === "asset" || l.type === "liability",
          ) ?? creditLines[0];
        const dstLine =
          debitLines.find(
            (l) => l.type === "asset" || l.type === "liability",
          ) ?? debitLines[0];
        accountId = srcLine.accountId;
        accountName = srcLine.name;
        transferAccountName = dstLine?.name ?? null;
        signedAmountFormatted = amountFormatted;
        break;
      }
    }

    result.push({
      id: entry.id,
      type,
      accountId,
      accountName,
      categoryName,
      categoryAccountId,
      amount,
      amountFormatted,
      signedAmountFormatted,
      description: entry.description,
      date: entry.date,
      notes: entry.notes,
      createdAt: entry.createdAt,
      transferAccountName,
    });
  }

  return result;
}

export async function getTransactionCount(
  filters: Omit<TransactionFilters, "limit" | "offset">,
): Promise<number> {
  const whereClause = sql.join(buildConditions(filters), sql` AND `);

  const [result] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM journal_entries je
    WHERE ${whereClause}
  `);

  return parseInt(result.count, 10);
}

// ── Aggregation ──────────────────────────────────────────────────────────

export async function getSpendingSummary(
  userId: string,
  startDate: string,
  endDate: string,
) {
  // Expenses are debits (positive amounts) on expense-type accounts
  const rows = await db.execute<{
    account_id: string;
    account_name: string;
    total: string;
    count: string;
  }>(sql`
    SELECT
      a.id   AS account_id,
      a.name AS account_name,
      SUM(jl.amount)::text        AS total,
      COUNT(DISTINCT je.id)::text AS count
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts        a  ON jl.account_id = a.id
    WHERE je.user_id = ${userId}
      AND je.date BETWEEN ${startDate} AND ${endDate}
      AND a.type   = 'expense'
      AND jl.amount > 0
    GROUP BY a.id, a.name
    ORDER BY SUM(jl.amount) DESC
  `);

  const categories = rows.map((r) => ({
    category: r.account_name,
    total: toMajorUnits(BigInt(r.total)),
    transactionCount: parseInt(r.count, 10),
  }));

  return {
    period: { startDate, endDate },
    categories,
    totalSpending: categories.reduce((s, r) => s + r.total, 0),
  };
}

export async function getIncomeSummary(
  userId: string,
  startDate: string,
  endDate: string,
) {
  // Income is credited (negative amounts) on income-type accounts — take ABS
  const rows = await db.execute<{
    account_id: string;
    account_name: string;
    total: string;
    count: string;
  }>(sql`
    SELECT
      a.id   AS account_id,
      a.name AS account_name,
      SUM(ABS(jl.amount))::text   AS total,
      COUNT(DISTINCT je.id)::text AS count
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts        a  ON jl.account_id = a.id
    WHERE je.user_id = ${userId}
      AND je.date BETWEEN ${startDate} AND ${endDate}
      AND a.type   = 'income'
      AND jl.amount < 0
    GROUP BY a.id, a.name
    ORDER BY SUM(ABS(jl.amount)) DESC
  `);

  const categories = rows.map((r) => ({
    category: r.account_name,
    total: toMajorUnits(BigInt(r.total)),
    transactionCount: parseInt(r.count, 10),
  }));

  return {
    period: { startDate, endDate },
    categories,
    totalIncome: categories.reduce((s, r) => s + r.total, 0),
  };
}

export async function getCashFlow(
  userId: string,
  startDate: string,
  endDate: string,
) {
  const [result] = await db.execute<{ income: string; expenses: string }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN a.type = 'income'  AND jl.amount < 0 THEN ABS(jl.amount) ELSE 0 END), 0)::text AS income,
      COALESCE(SUM(CASE WHEN a.type = 'expense' AND jl.amount > 0 THEN     jl.amount  ELSE 0 END), 0)::text AS expenses
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts        a  ON jl.account_id = a.id
    WHERE je.user_id = ${userId}
      AND je.date BETWEEN ${startDate} AND ${endDate}
  `);

  const income = toMajorUnits(BigInt(result.income));
  const expenses = toMajorUnits(BigInt(result.expenses));

  return {
    period: { startDate, endDate },
    income,
    expenses,
    netCashFlow: income - expenses,
  };
}
