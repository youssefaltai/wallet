/**
 * Double-entry bookkeeping engine.
 *
 * This is the internal accounting core. It is NEVER exposed to AI tools or UI.
 * Other services (accounts, transactions, goals) use this to record financial events.
 *
 * Rules:
 * - Every journal entry must have lines that sum to exactly 0.
 * - Positive amount = debit, negative amount = credit.
 * - Asset/Expense accounts: debit increases, credit decreases.
 * - Liability/Equity/Income accounts: credit increases, debit decreases.
 */

import { db } from "@/lib/db";
import { accounts, journalEntries, journalLines } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

/** Transaction-capable DB handle. Pass to service functions for atomicity. */
export type Tx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface JournalLine {
  accountId: string;
  amount: bigint; // positive = debit, negative = credit
}

/**
 * Record a journal entry with balanced lines.
 * Throws if lines don't sum to zero or if fewer than 2 lines are provided.
 */
export async function createJournalEntry(
  userId: string,
  date: string,
  description: string | null,
  notes: string | null,
  lines: JournalLine[],
  tx?: Tx,
) {
  const sum = lines.reduce((acc, line) => acc + line.amount, 0n);
  if (sum !== 0n) {
    throw new Error(
      `Journal entry lines must sum to zero, got ${sum.toString()}`,
    );
  }
  if (lines.length < 2) {
    throw new Error("Journal entry must have at least 2 lines");
  }

  const run = async (conn: Tx) => {
    const [entry] = await conn
      .insert(journalEntries)
      .values({ userId, date, description, notes })
      .returning();

    await conn.insert(journalLines).values(
      lines.map((line) => ({
        journalEntryId: entry.id,
        accountId: line.accountId,
        amount: line.amount,
      })),
    );

    return entry;
  };

  return tx ? run(tx) : db.transaction(run);
}

/**
 * Compute balances for multiple accounts in one query.
 * Returns a map of accountId → balance (sum of all journal lines for that account).
 *
 * For asset/expense accounts: positive balance = normal (debit balance).
 * For liability/equity/income accounts: negative balance = normal (credit balance).
 * Callers are responsible for negating liability/income balances for display.
 */
export async function getAccountBalances(
  accountIds: string[],
): Promise<Map<string, bigint>> {
  if (accountIds.length === 0) return new Map();

  const results = await db
    .select({
      accountId: journalLines.accountId,
      balance: sql<string>`COALESCE(SUM(${journalLines.amount}), 0)`,
    })
    .from(journalLines)
    .where(inArray(journalLines.accountId, accountIds))
    .groupBy(journalLines.accountId);

  const map = new Map<string, bigint>();
  for (const id of accountIds) {
    map.set(id, 0n);
  }
  for (const row of results) {
    map.set(row.accountId, BigInt(row.balance));
  }
  return map;
}

/** Delete a journal entry and its lines (cascades via FK). */
export async function deleteJournalEntry(
  journalEntryId: string,
  userId: string,
  tx: Tx = db,
) {
  await tx
    .delete(journalEntries)
    .where(
      and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.userId, userId),
      ),
    );
}
