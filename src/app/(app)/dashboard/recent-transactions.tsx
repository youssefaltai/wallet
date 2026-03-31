"use client";

import { TransactionTable } from "@/components/shared/transaction-table";
import type { TransactionRow } from "@/lib/services/transactions";

export function DashboardRecentTransactions({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  return (
    <TransactionTable
      transactions={transactions}
      emptyMessage="No transactions yet."
    />
  );
}
