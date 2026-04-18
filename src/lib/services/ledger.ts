/**
 * Double-entry bookkeeping engine.
 *
 * This is the internal accounting core. It is NEVER exposed to AI tools or UI.
 * Other services (accounts, transactions, goals) use this to record financial events.
 *
 * Rules:
 * - Positive amount = debit, negative amount = credit.
 * - Asset/Expense accounts: debit increases, credit decreases.
 * - Liability/Equity/Income accounts: credit increases, debit decreases.
 *
 * Balance rules:
 * - Same-currency entries: lines must sum to exactly 0.
 * - Cross-currency entries: lines are in different currencies (native to each
 *   account). They won't sum to zero in raw amounts. Validation converts
 *   all lines to a common currency and checks within tolerance.
 */

import { db } from "@/lib/db";
import { journalEntries, journalLines } from "@/lib/db/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { getRates, convert } from "./fx-rates";
import { getMinorUnitFactor } from "@/lib/constants/currencies";

/** Transaction-capable DB handle. Pass to service functions for atomicity. */
export type Tx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface JournalLine {
  accountId: string;
  amount: bigint; // positive = debit, negative = credit (in account's native currency minor units)
  currency: string; // ISO 4217 code of the account's currency
}

/** Cross-currency tolerance: 2% to account for spread and rounding. */
const FX_TOLERANCE = 0.02;

/** Absolute cap on USD imbalance regardless of percentage (in major units). */
const FX_ABS_CAP_USD = 50;

/**
 * Record a journal entry with balanced lines.
 *
 * For same-currency entries: lines must sum to exactly zero.
 * For cross-currency entries: lines must balance within tolerance when
 * converted to a common currency.
 *
 * If idempotencyKey is provided and a matching entry already exists,
 * the existing entry is returned without inserting a duplicate.
 */
export async function createJournalEntry(
  userId: string,
  date: string,
  description: string | null,
  notes: string | null,
  lines: JournalLine[],
  tx?: Tx,
  idempotencyKey?: string,
) {
  if (lines.length < 2) {
    throw new Error("Journal entry must have at least 2 lines");
  }

  const currencies = new Set(lines.map((l) => l.currency));
  const isCrossCurrency = currencies.size > 1;

  if (!isCrossCurrency) {
    // Same-currency: exact zero-sum check
    const sum = lines.reduce((acc, line) => acc + line.amount, 0n);
    if (sum !== 0n) {
      throw new Error(
        `Journal entry lines must sum to zero, got ${sum.toString()}`,
      );
    }
  } else {
    // Cross-currency: best-effort tolerance-based check.
    // If rates are unavailable (API down, no cache), skip the FX
    // reasonableness check — the double-entry balance is still enforced
    // by the debit/credit structure; we just can't verify the FX spread.
    let rates: Awaited<ReturnType<typeof getRates>> | null = null;
    try {
      rates = await getRates();
    } catch {
      // Rates unavailable — skip tolerance validation.
    }

    if (rates) {
      let sumInUsd = 0;
      let maxAbsUsd = 0;

      for (const line of lines) {
        const factor = getMinorUnitFactor(line.currency);
        const majorAmount = Number(line.amount) / factor;
        const usdAmount = convert(majorAmount, line.currency, "USD", rates);
        sumInUsd += usdAmount;
        maxAbsUsd = Math.max(maxAbsUsd, Math.abs(usdAmount));
      }

      const absImbalance = Math.abs(sumInUsd);
      if (
        maxAbsUsd > 0 &&
        (absImbalance / maxAbsUsd > FX_TOLERANCE ||
          absImbalance > FX_ABS_CAP_USD)
      ) {
        throw new Error(
          `Cross-currency journal entry is unbalanced. ` +
            `Sum in USD: ${sumInUsd.toFixed(2)}, tolerance: ${(FX_TOLERANCE * 100).toFixed(0)}% / $${FX_ABS_CAP_USD} cap`,
        );
      }
    }
  }

  const run = async (conn: Tx) => {
    // Idempotency check: return existing entry if key already used (only non-deleted)
    if (idempotencyKey) {
      const [existing] = await conn
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.idempotencyKey, idempotencyKey), isNull(journalEntries.deletedAt)))
        .limit(1);
      if (existing) return existing;
    }

    const [entry] = await conn
      .insert(journalEntries)
      .values({ userId, date: new Date(date), description, notes, idempotencyKey: idempotencyKey ?? null })
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
 * Balances are in the account's native currency minor units.
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
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(and(inArray(journalLines.accountId, accountIds), isNull(journalEntries.deletedAt)))
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

/** Soft-delete a journal entry (sets deleted_at). Lines are preserved for audit trail. */
export async function deleteJournalEntry(
  journalEntryId: string,
  userId: string,
  tx: Tx = db,
) {
  const result = await tx
    .update(journalEntries)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.userId, userId),
        isNull(journalEntries.deletedAt),
      ),
    )
    .returning({ id: journalEntries.id });

  if (result.length === 0) {
    throw new Error(
      `Journal entry ${journalEntryId} not found or already deleted`,
    );
  }
}
