import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPeriod, isValidToolOutput } from "./format";

interface CashFlowData {
  period: { startDate: string; endDate: string };
  income: number;
  expenses: number;
  netCashFlow: number;
}

export function CashFlowCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("income" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CashFlowData;

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {formatPeriod(data.period)}
        </p>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="font-medium tabular-nums text-positive">
              {formatCurrency(data.income)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="font-medium tabular-nums text-negative">
              {formatCurrency(data.expenses)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={`font-semibold tabular-nums ${data.netCashFlow >= 0 ? "text-positive" : "text-negative"}`}
            >
              {formatCurrency(data.netCashFlow)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
