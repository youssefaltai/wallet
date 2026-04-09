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
 * Cross-currency:
 *   - Expenses/income: both legs use the financial account's currency.
 *   - Transfers between accounts with different currencies: each leg uses
 *     its account's native currency. The two amounts are provided separately.
 *
 * User/AI never see debit, credit, journal, or ledger terminology.
 */

import { db } from "@/lib/db";
import { journalEntries, journalLines, accounts } from "@/lib/db/schema";
import { eq, and, sql, inArray, isNull, type SQL } from "drizzle-orm";
import { createJournalEntry, deleteJournalEntry, type Tx } from "./ledger";
import { toMinorUnits, toMajorUnits, formatMoney } from "./money";
import { getRates, convert } from "./fx-rates"; // used only for read-side aggregation (summaries, cash flow)

// ── Types ────────────────────────────────────────────────────────────────

export type TransactionType = "expense" | "income" | "transfer";

export interface CreateTransactionInput {
  userId: string;
  debitAccountId: string; // unified accounts.id — account being debited
  creditAccountId: string; // unified accounts.id — account being credited
  amount: number; // major units, always positive (in debit account's currency)
  creditAmount?: number; // major units for credit side — only for cross-currency transfers
  exchangeRate?: number; // debit currency → credit currency conversion rate.
  //   For expenses:   debit = expense category, credit = financial account.
  //                   Rate means "1 unit of category currency = X units of account currency".
  //   For income:     debit = financial account, credit = income source.
  //                   Rate means "1 unit of account currency = X units of source currency".
  //   For transfers:  debit = destination account, credit = source account.
  //                   Rate means "1 unit of destination currency = X units of source currency".
  description?: string;
  date: string; // ISO datetime or YYYY-MM-DD
  notes?: string;
  currency?: string; // user's base currency (for formatting only)
  idempotencyKey?: string; // AI-generated key to prevent duplicate entries on retry
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
  currency?: string; // user's base currency (for formatting)
}

export interface TransactionRow {
  id: string; // journal_entry.id
  type: TransactionType;
  accountId: string; // the asset/liability account involved
  accountName: string;
  currency: string; // the primary account's currency
  categoryName: string | null; // expense category or income source; null for transfers
  categoryAccountId: string | null;
  amount: number; // major units, always positive
  amountFormatted: string;
  signedAmountFormatted: string; // "-$52.30" for expenses, "$52.30" otherwise
  description: string | null;
  date: string; // ISO datetime string
  notes: string | null;
  createdAt: Date;
  transferAccountName: string | null; // destination account name for transfers
  transferAmount: number | null; // destination amount for cross-currency transfers
  transferAmountFormatted: string | null; // formatted destination amount
  transferCurrency: string | null; // destination currency for cross-currency transfers
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
  const c: SQL[] = [
    sql`je.user_id = ${filters.userId}`,
    sql`je.deleted_at IS NULL`,
  ];

  if (filters.startDate && filters.endDate) {
    c.push(sql`je.date::date BETWEEN ${filters.startDate} AND ${filters.endDate}`);
  } else if (filters.startDate) {
    c.push(sql`je.date::date >= ${filters.startDate}`);
  } else if (filters.endDate) {
    c.push(sql`je.date::date <= ${filters.endDate}`);
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

/**
 * Query current account balance within the given transaction context (minor units).
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

export async function createTransaction(input: CreateTransactionInput) {
  return db.transaction(async (tx) => {
    // Fetch both accounts to get their currencies and types
    const accountIds = [input.debitAccountId, input.creditAccountId];
    const owned = await tx
      .select({ id: accounts.id, currency: accounts.currency, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.userId, input.userId), inArray(accounts.id, accountIds)));
    if (owned.length < new Set(accountIds).size) {
      throw new Error("Account not found");
    }

    const debitAccount = owned.find((a) => a.id === input.debitAccountId);
    const creditAccount = owned.find((a) => a.id === input.creditAccountId);
    if (!debitAccount || !creditAccount) throw new Error("Account not found");

    const isCrossCurrency = debitAccount.currency !== creditAccount.currency;

    let debitMinor: bigint;
    let creditMinor: bigint;

    if (isCrossCurrency) {
      const hasAmount = input.amount !== undefined && input.amount > 0;
      const hasCreditAmount = input.creditAmount !== undefined && input.creditAmount > 0;
      const hasRate = input.exchangeRate !== undefined && input.exchangeRate > 0;

      let resolvedAmount = hasAmount ? Math.abs(input.amount) : 0;
      let resolvedCreditAmount = hasCreditAmount ? Math.abs(input.creditAmount!) : 0;

      if (hasAmount && hasCreditAmount) {
        // Rule 1 & 2: both amounts provided — use them directly (ignore rate if present)
      } else if (hasAmount && hasRate) {
        // Rule 3: compute creditAmount from amount * exchangeRate
        resolvedCreditAmount = resolvedAmount * input.exchangeRate!;
      } else if (hasCreditAmount && hasRate) {
        // Rule 4: compute amount from creditAmount / exchangeRate
        resolvedAmount = resolvedCreditAmount / input.exchangeRate!;
      } else {
        throw new Error(
          "Cross-currency transactions require at least two of: amount, creditAmount, exchangeRate. " +
          `Debit account uses ${debitAccount.currency}, credit account uses ${creditAccount.currency}. ` +
          "Provide any two of: amount (source currency) + creditAmount (destination currency), " +
          "amount + exchangeRate, or creditAmount + exchangeRate.",
        );
      }

      debitMinor = toMinorUnits(resolvedAmount, debitAccount.currency);
      creditMinor = toMinorUnits(resolvedCreditAmount, creditAccount.currency);
    } else {
      // Same-currency
      debitMinor = toMinorUnits(Math.abs(input.amount), debitAccount.currency);
      creditMinor = debitMinor;
    }

    // Overdraft check for asset-to-asset transfers: credit side is the source account
    const isTransfer =
      (creditAccount.type === "asset" || creditAccount.type === "liability") &&
      (debitAccount.type === "asset" || debitAccount.type === "liability");
    if (isTransfer) {
      const srcBalance = await getBalanceInTx(tx, input.creditAccountId);
      if (srcBalance - creditMinor < 0n) {
        throw new Error(
          `Insufficient balance in source account. Available: ${formatMoney(srcBalance < 0n ? 0n : srcBalance, creditAccount.currency)}, required: ${formatMoney(creditMinor, creditAccount.currency)}.`,
        );
      }
    }

    const entry = await createJournalEntry(
      input.userId,
      input.date,
      input.description ?? null,
      input.notes ?? null,
      [
        { accountId: input.debitAccountId, amount: debitMinor, currency: debitAccount.currency },
        { accountId: input.creditAccountId, amount: -creditMinor, currency: creditAccount.currency },
      ],
      tx,
      input.idempotencyKey,
    );

    // Format using the debit account's currency
    const displayCurrency = debitAccount.currency;

    return {
      id: entry.id,
      date: entry.date,
      description: entry.description,
      notes: entry.notes,
      amount: toMajorUnits(debitMinor, displayCurrency),
      amountFormatted: formatMoney(debitMinor, displayCurrency),
    };
  });
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
    // 1. Update journal entry metadata (always stamp updatedAt)
    const entryUpdates: Partial<typeof journalEntries.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (updates.description !== undefined)
      entryUpdates.description = updates.description;
    if (updates.notes !== undefined) entryUpdates.notes = updates.notes;

    const [entry] = await tx
      .update(journalEntries)
      .set(entryUpdates)
      .where(
        and(
          eq(journalEntries.id, transactionId),
          eq(journalEntries.userId, userId),
          isNull(journalEntries.deletedAt),
        ),
      )
      .returning();
    if (!entry) throw new Error("Transaction not found");

    // 2. Swap the debit line's account (positive amount = debit)
    if (updates.debitAccountId !== undefined) {
      // Validate currency compatibility
      const [currentDebitLine] = await tx
        .select({ accountId: journalLines.accountId })
        .from(journalLines)
        .where(
          and(
            eq(journalLines.journalEntryId, transactionId),
            sql`${journalLines.amount} > 0`,
          ),
        )
        .limit(1);

      if (currentDebitLine && currentDebitLine.accountId !== updates.debitAccountId) {
        const accts = await tx
          .select({ id: accounts.id, currency: accounts.currency })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), inArray(accounts.id, [currentDebitLine.accountId, updates.debitAccountId])));

        const currentCurrency = accts.find(a => a.id === currentDebitLine.accountId)?.currency;
        const newCurrency = accts.find(a => a.id === updates.debitAccountId)?.currency;

        if (!newCurrency) throw new Error("Account not found");
        if (currentCurrency && newCurrency !== currentCurrency) {
          throw new Error(
            "Cannot reassign to an account with a different currency. Delete and recreate the transaction instead."
          );
        }
      }

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
      // Validate currency compatibility
      const [currentCreditLine] = await tx
        .select({ accountId: journalLines.accountId })
        .from(journalLines)
        .where(
          and(
            eq(journalLines.journalEntryId, transactionId),
            sql`${journalLines.amount} < 0`,
          ),
        )
        .limit(1);

      if (currentCreditLine && currentCreditLine.accountId !== updates.creditAccountId) {
        const accts = await tx
          .select({ id: accounts.id, currency: accounts.currency })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), inArray(accounts.id, [currentCreditLine.accountId, updates.creditAccountId])));

        const currentCurrency = accts.find(a => a.id === currentCreditLine.accountId)?.currency;
        const newCurrency = accts.find(a => a.id === updates.creditAccountId)?.currency;

        if (!newCurrency) throw new Error("Account not found");
        if (currentCurrency && newCurrency !== currentCurrency) {
          throw new Error(
            "Cannot reassign to an account with a different currency. Delete and recreate the transaction instead."
          );
        }
      }

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

// ── Batch ────────────────────────────────────────────────────────────────

/**
 * Create multiple transactions in a single DB transaction (all-or-nothing).
 * Returns the count and per-currency subtotals on success, or the failed index on error.
 */
export async function batchCreateTransactions(
  inputs: CreateTransactionInput[],
): Promise<{ count: number; totals: { currency: string; totalMinor: bigint }[] }> {
  if (inputs.length === 0) throw new Error("No transactions to create");
  if (inputs.length > 50) throw new Error("Maximum 50 transactions per batch");

  return db.transaction(async (tx) => {
    const totalsMap = new Map<string, bigint>();

    // Collect all unique account IDs across all inputs (all inputs share the same userId)
    const userId = inputs[0].userId;
    const allAccountIds = [...new Set(inputs.flatMap((inp) => [inp.debitAccountId, inp.creditAccountId]))];
    const ownedRows = await tx
      .select({ id: accounts.id, currency: accounts.currency, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), inArray(accounts.id, allAccountIds)));
    const accountMap = new Map(ownedRows.map((a) => [a.id, a]));

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      try {
        // Look up both accounts from the pre-fetched map
        const debitAccount = accountMap.get(input.debitAccountId);
        const creditAccount = accountMap.get(input.creditAccountId);
        if (!debitAccount || !creditAccount) {
          throw new Error("Account not found");
        }

        const isCrossCurrency = debitAccount.currency !== creditAccount.currency;

        let debitMinor: bigint;
        let creditMinor: bigint;

        if (isCrossCurrency) {
          const hasAmount = input.amount !== undefined && input.amount > 0;
          const hasCreditAmount = input.creditAmount !== undefined && input.creditAmount > 0;
          const hasRate = input.exchangeRate !== undefined && input.exchangeRate > 0;

          let resolvedAmount = hasAmount ? Math.abs(input.amount) : 0;
          let resolvedCreditAmount = hasCreditAmount ? Math.abs(input.creditAmount!) : 0;

          if (hasAmount && hasCreditAmount) {
            // Both amounts provided — use them directly (ignore rate if present)
          } else if (hasAmount && hasRate) {
            resolvedCreditAmount = resolvedAmount * input.exchangeRate!;
          } else if (hasCreditAmount && hasRate) {
            resolvedAmount = resolvedCreditAmount / input.exchangeRate!;
          } else {
            throw new Error(
              "Cross-currency transactions require at least two of: amount, creditAmount, exchangeRate. " +
              `Debit account uses ${debitAccount.currency}, credit account uses ${creditAccount.currency}. ` +
              "Provide any two of: amount (source currency) + creditAmount (destination currency), " +
              "amount + exchangeRate, or creditAmount + exchangeRate.",
            );
          }

          debitMinor = toMinorUnits(resolvedAmount, debitAccount.currency);
          creditMinor = toMinorUnits(resolvedCreditAmount, creditAccount.currency);
        } else {
          debitMinor = toMinorUnits(Math.abs(input.amount), debitAccount.currency);
          creditMinor = debitMinor;
        }

        // Overdraft check for asset-to-asset transfers: credit side is the source account
        const isTransfer =
          (creditAccount.type === "asset" || creditAccount.type === "liability") &&
          (debitAccount.type === "asset" || debitAccount.type === "liability");
        if (isTransfer) {
          const srcBalance = await getBalanceInTx(tx, input.creditAccountId);
          if (srcBalance - creditMinor < 0n) {
            throw new Error(
              `Insufficient balance in source account. Available: ${formatMoney(srcBalance < 0n ? 0n : srcBalance, creditAccount.currency)}, required: ${formatMoney(creditMinor, creditAccount.currency)}.`,
            );
          }
        }

        await createJournalEntry(
          input.userId,
          input.date,
          input.description ?? null,
          input.notes ?? null,
          [
            { accountId: input.debitAccountId, amount: debitMinor, currency: debitAccount.currency },
            { accountId: input.creditAccountId, amount: -creditMinor, currency: creditAccount.currency },
          ],
          tx,
          input.idempotencyKey,
        );

        // Accumulate per-currency subtotals (using debit account's currency)
        const cur = debitAccount.currency;
        totalsMap.set(cur, (totalsMap.get(cur) ?? 0n) + debitMinor);
      } catch (error) {
        throw new Error(
          `Item ${i}: ${error instanceof Error ? error.message : "Operation failed"}`,
        );
      }
    }

    const totals = Array.from(totalsMap.entries()).map(([currency, totalMinor]) => ({
      currency,
      totalMinor,
    }));

    return { count: inputs.length, totals };
  });
}

/**
 * Delete multiple transactions in a single DB transaction (all-or-nothing).
 */
export async function batchDeleteTransactions(
  transactionIds: string[],
  userId: string,
): Promise<{ count: number }> {
  if (transactionIds.length === 0) throw new Error("No transactions to delete");
  if (transactionIds.length > 50) throw new Error("Maximum 50 deletions per batch");

  return db.transaction(async (tx) => {
    for (let i = 0; i < transactionIds.length; i++) {
      try {
        await deleteJournalEntry(transactionIds[i], userId, tx);
      } catch (error) {
        throw new Error(
          `Item ${i}: ${error instanceof Error ? error.message : "Operation failed"}`,
        );
      }
    }
    return { count: transactionIds.length };
  });
}

// ── Query ─────────────────────────────────────────────────────────────────

export async function getTransactions(
  filters: TransactionFilters,
): Promise<TransactionRow[]> {
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
    account_currency: string;
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
      a.type           AS account_type,
      a.currency       AS account_currency
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
    currency: string;
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
      currency: row.account_currency,
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

    let accountId: string;
    let accountName: string;
    let accountCurrency: string;
    let categoryName: string | null = null;
    let categoryAccountId: string | null = null;
    let transferAccountName: string | null = null;
    let transferAmount: number | null = null;
    let transferAmountFormatted: string | null = null;
    let transferCurrency: string | null = null;

    let displayMinor: bigint;
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
        accountCurrency = acctLine.currency;
        categoryName = catLine.name;
        categoryAccountId = catLine.accountId;
        // Amount comes from the credit side (absolute), in the financial account's currency
        displayMinor = -acctLine.amount; // credit is negative, negate to get positive
        signedAmountFormatted = `-${formatMoney(displayMinor, accountCurrency)}`;
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
        accountCurrency = acctLine.currency;
        categoryName = catLine.name;
        categoryAccountId = catLine.accountId;
        displayMinor = acctLine.amount;
        signedAmountFormatted = formatMoney(displayMinor, accountCurrency);
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
        accountCurrency = srcLine.currency;
        transferAccountName = dstLine?.name ?? null;
        displayMinor = -srcLine.amount; // credit is negative

        // Cross-currency transfer: show destination amount and currency
        if (dstLine && dstLine.currency !== srcLine.currency) {
          transferCurrency = dstLine.currency;
          transferAmount = toMajorUnits(dstLine.amount, dstLine.currency);
          transferAmountFormatted = formatMoney(dstLine.amount, dstLine.currency);
        }

        signedAmountFormatted = formatMoney(displayMinor, accountCurrency);
        break;
      }
    }

    const amount = toMajorUnits(displayMinor, accountCurrency);
    const amountFormatted = formatMoney(displayMinor, accountCurrency);

    result.push({
      id: entry.id,
      type,
      accountId,
      accountName,
      currency: accountCurrency,
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
      transferAmount,
      transferAmountFormatted,
      transferCurrency,
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

/**
 * Spending summary by category. All amounts converted to baseCurrency.
 */
export async function getSpendingSummary(
  userId: string,
  startDate: string,
  endDate: string,
  baseCurrency = "USD",
) {
  // Get raw expense amounts grouped by category, including the account currency
  const rows = await db.execute<{
    account_id: string;
    account_name: string;
    account_currency: string;
    total: string;
    count: string;
  }>(sql`
    SELECT
      a.id   AS account_id,
      a.name AS account_name,
      a.currency AS account_currency,
      SUM(jl.amount)::text        AS total,
      COUNT(DISTINCT je.id)::text AS count
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts        a  ON jl.account_id = a.id
    WHERE je.user_id = ${userId}
      AND je.deleted_at IS NULL
      AND je.date::date BETWEEN ${startDate} AND ${endDate}
      AND a.type   = 'expense'
      AND jl.amount > 0
    GROUP BY a.id, a.name, a.currency
    ORDER BY SUM(jl.amount) DESC
  `);

  // Convert each category total to base currency
  let rates: Record<string, number> | null = null;
  const needsConversion = rows.some((r) => r.account_currency !== baseCurrency);
  if (needsConversion) {
    rates = await getRates();
  }

  const categories = rows.map((r) => {
    const nativeTotal = toMajorUnits(BigInt(r.total), r.account_currency);
    const total =
      r.account_currency === baseCurrency
        ? nativeTotal
        : convert(nativeTotal, r.account_currency, baseCurrency, rates!);
    return {
      category: r.account_name,
      total,
      transactionCount: parseInt(r.count, 10),
    };
  });

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
  baseCurrency = "USD",
) {
  const rows = await db.execute<{
    account_id: string;
    account_name: string;
    account_currency: string;
    total: string;
    count: string;
  }>(sql`
    SELECT
      a.id   AS account_id,
      a.name AS account_name,
      a.currency AS account_currency,
      SUM(ABS(jl.amount))::text   AS total,
      COUNT(DISTINCT je.id)::text AS count
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts        a  ON jl.account_id = a.id
    WHERE je.user_id = ${userId}
      AND je.deleted_at IS NULL
      AND je.date::date BETWEEN ${startDate} AND ${endDate}
      AND a.type   = 'income'
      AND jl.amount < 0
    GROUP BY a.id, a.name, a.currency
    ORDER BY SUM(ABS(jl.amount)) DESC
  `);

  let rates: Record<string, number> | null = null;
  const needsConversion = rows.some((r) => r.account_currency !== baseCurrency);
  if (needsConversion) {
    rates = await getRates();
  }

  const categories = rows.map((r) => {
    const nativeTotal = toMajorUnits(BigInt(r.total), r.account_currency);
    const total =
      r.account_currency === baseCurrency
        ? nativeTotal
        : convert(nativeTotal, r.account_currency, baseCurrency, rates!);
    return {
      category: r.account_name,
      total,
      transactionCount: parseInt(r.count, 10),
    };
  });

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
  baseCurrency = "USD",
) {
  // Get per-currency income/expense totals
  const rows = await db.execute<{
    account_type: string;
    account_currency: string;
    total: string;
  }>(sql`
    SELECT
      a.type AS account_type,
      a.currency AS account_currency,
      CASE
        WHEN a.type = 'income' THEN SUM(ABS(jl.amount))::text
        WHEN a.type = 'expense' THEN SUM(jl.amount)::text
      END AS total
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts        a  ON jl.account_id = a.id
    WHERE je.user_id = ${userId}
      AND je.deleted_at IS NULL
      AND je.date::date BETWEEN ${startDate} AND ${endDate}
      AND (
        (a.type = 'income' AND jl.amount < 0)
        OR (a.type = 'expense' AND jl.amount > 0)
      )
    GROUP BY a.type, a.currency
  `);

  let rates: Record<string, number> | null = null;
  const needsConversion = rows.some((r) => r.account_currency !== baseCurrency);
  if (needsConversion) {
    rates = await getRates();
  }

  let income = 0;
  let expenses = 0;

  for (const row of rows) {
    const nativeTotal = toMajorUnits(BigInt(row.total), row.account_currency);
    const converted =
      row.account_currency === baseCurrency
        ? nativeTotal
        : convert(nativeTotal, row.account_currency, baseCurrency, rates!);

    if (row.account_type === "income") income += converted;
    else expenses += converted;
  }

  return {
    period: { startDate, endDate },
    income,
    expenses,
    netCashFlow: income - expenses,
  };
}
