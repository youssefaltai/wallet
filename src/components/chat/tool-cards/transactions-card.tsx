"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, isValidToolOutput } from "./format";

interface Transaction {
  id: string;
  accountId: string;
  accountName: string;
  amount: number;
  amountFormatted: string;
  description: string;
  categoryName: string | null;
  date: string;
  notes: string | null;
}

interface TransactionsData {
  transactions: Transaction[];
  message?: string;
}

const COLLAPSED_LIMIT = 5;

export function TransactionsCard({ output }: { output: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (!output || typeof output !== "object") return null;
  if (!("transactions" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as TransactionsData;

  if (data.transactions.length === 0) {
    return (
      <Card size="sm" className="max-w-sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data.message ?? "No transactions found."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const visible = expanded
    ? data.transactions
    : data.transactions.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = data.transactions.length - COLLAPSED_LIMIT;

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-0">
        {visible.map((t) => (
          <div key={t.id} className="py-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium truncate">{t.description}</span>
              <span
                className={`tabular-nums shrink-0 font-medium ${t.amount >= 0 ? "text-positive" : "text-negative"}`}
              >
                {formatCurrency(t.amount)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDate(t.date)}
              {t.categoryName && <span> · {t.categoryName}</span>}
              {t.accountName && <span> · {t.accountName}</span>}
            </div>
          </div>
        ))}
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            Show {hiddenCount} more…
          </button>
        )}
      </CardContent>
    </Card>
  );
}
