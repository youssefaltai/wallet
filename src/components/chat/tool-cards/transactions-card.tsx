"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidToolOutput } from "./format";

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
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  if (!output || typeof output !== "object") return null;
  if (!("transactions" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as TransactionsData;

  if (data.transactions.length === 0) return null;

  const visible = expanded
    ? data.transactions
    : data.transactions.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = data.transactions.length - COLLAPSED_LIMIT;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push("/transactions")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {data.transactions.length} transaction{data.transactions.length !== 1 && "s"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {visible.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between py-2 border-b last:border-b-0"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{t.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.categoryName && <span>{t.categoryName}</span>}
                {t.categoryName && t.accountName && <span> · </span>}
                {t.accountName && <span>{t.accountName}</span>}
              </p>
            </div>
            <span
              className={`tabular-nums shrink-0 ml-4 font-medium ${t.amount >= 0 ? "text-positive" : "text-negative"}`}
            >
              {t.amountFormatted}
            </span>
          </div>
        ))}
        {hiddenCount > 0 && !expanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
          >
            Show {hiddenCount} more…
          </button>
        )}
      </CardContent>
    </Card>
  );
}
