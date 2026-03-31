"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDateTime, isValidToolOutput } from "./format";

interface CreateTransactionResult {
  success: boolean;
  transaction: {
    id: string;
    amount: number;
    amountFormatted: string;
    description: string;
    category?: string | null;
    source?: string | null;
    date: string;
  };
}

export function CreateTransactionCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("transaction" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateTransactionResult;
  const t = data.transaction;
  const label = t.category ?? t.source;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push("/transactions")}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {t.description}
        </CardTitle>
        {label && <Badge variant="secondary">{label}</Badge>}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold tabular-nums ${t.amount >= 0 ? "text-positive" : "text-negative"}`}
        >
          {t.amountFormatted}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeDateTime(t.date)}
        </p>
      </CardContent>
    </Card>
  );
}
