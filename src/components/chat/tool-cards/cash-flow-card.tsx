"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPeriod, isValidToolOutput } from "./format";

interface CashFlowData {
  period: { startDate: string; endDate: string };
  income: number;
  expenses: number;
  netCashFlow: number;
  currency?: string;
}

export function CashFlowCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("income" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CashFlowData;
  const cur = data.currency;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push("/dashboard")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatPeriod(data.period)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`text-2xl font-bold tabular-nums ${data.netCashFlow >= 0 ? "text-positive" : "text-negative"}`}
        >
          {formatCurrency(data.netCashFlow, cur)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-sm font-medium tabular-nums text-positive">
              {formatCurrency(data.income, cur)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-sm font-medium tabular-nums text-negative">
              {formatCurrency(data.expenses, cur)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
