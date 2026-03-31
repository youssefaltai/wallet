import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, isValidToolOutput } from "./format";

interface CreateBudgetResult {
  success: boolean;
  budget: { id: string; name: string; amount: number; amountFormatted: string };
}

export function CreateBudgetCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("budget" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateBudgetResult;
  return (
    <Card size="sm" className="max-w-sm">
      <CardContent>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{data.budget.name}</span>
            <span className="tabular-nums text-muted-foreground text-xs shrink-0 ml-3">
              {formatCurrency(0)} / {formatCurrency(data.budget.amount)}
            </span>
          </div>
          <ProgressBar
            value={0}
            className="h-1 overflow-hidden"
            barClassName="bg-positive"
          />
          <p className="text-xs text-muted-foreground">
            {formatCurrency(data.budget.amount)} left · 0% used
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
