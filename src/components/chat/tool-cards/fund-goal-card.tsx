import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, isValidToolOutput } from "./format";

interface GoalFundResult {
  success: boolean;
  goal: {
    id: string;
    name: string;
    currentAmount: number;
    currentAmountFormatted: string;
    targetAmount: number;
    targetAmountFormatted: string;
    progressPercent: number;
  };
}

export function GoalFundCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("goal" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as GoalFundResult;
  const g = data.goal;
  return (
    <Card size="sm" className="max-w-sm">
      <CardContent>
        <div className="py-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium truncate">{g.name}</span>
            <span className="tabular-nums shrink-0 ml-3 text-sm">
              {formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}
            </span>
          </div>
          <ProgressBar
            value={g.progressPercent}
            className="mt-1.5 h-1.5 overflow-hidden"
            barClassName="bg-primary transition-all"
          />
          <p className="mt-0.5 text-xs text-muted-foreground text-right">
            {g.progressPercent}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
