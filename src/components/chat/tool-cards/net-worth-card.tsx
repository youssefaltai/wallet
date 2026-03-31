"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, isValidToolOutput } from "./format";

interface NetWorthData {
  netWorth: number;
  availableToSpend: number;
  totalAssets: number;
  totalLiabilities: number;
  goalSavings: number;
  accountCount: number;
  currency?: string;
}

export function NetWorthCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("netWorth" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as NetWorthData;
  const cur = data.currency;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push("/accounts")}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Net Worth</CardTitle>
        <Badge variant="secondary">
          {data.accountCount} account{data.accountCount !== 1 && "s"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={`text-2xl font-bold tabular-nums ${data.netWorth >= 0 ? "text-positive" : "text-negative"}`}
        >
          {formatCurrency(data.netWorth, cur)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Available to spend</p>
            <p className="text-sm font-medium tabular-nums">
              {formatCurrency(data.availableToSpend, cur)}
            </p>
          </div>
          {data.goalSavings > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Goal savings</p>
              <p className="text-sm font-medium tabular-nums">
                {formatCurrency(data.goalSavings, cur)}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Liabilities</p>
            <p className="text-sm font-medium tabular-nums text-negative">
              {formatCurrency(data.totalLiabilities, cur)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
