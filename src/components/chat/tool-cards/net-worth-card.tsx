import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, isValidToolOutput } from "./format";

interface NetWorthData {
  netWorth: number;
  availableToSpend: number;
  totalAssets: number;
  totalLiabilities: number;
  goalSavings: number;
  accountCount: number;
}

export function NetWorthCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("netWorth" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as NetWorthData;

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Net worth · {data.accountCount} account{data.accountCount !== 1 && "s"}
          </p>
          <p
            className={`text-xl font-semibold tabular-nums ${data.netWorth >= 0 ? "text-positive" : "text-negative"}`}
          >
            {formatCurrency(data.netWorth)}
          </p>
        </div>
        <div className="flex gap-6 text-sm flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground">Available to spend</p>
            <p className="font-medium tabular-nums">
              {formatCurrency(data.availableToSpend)}
            </p>
          </div>
          {data.goalSavings > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Goal savings</p>
              <p className="font-medium tabular-nums">
                {formatCurrency(data.goalSavings)}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Liabilities</p>
            <p className="font-medium tabular-nums text-negative">
              {formatCurrency(data.totalLiabilities)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
