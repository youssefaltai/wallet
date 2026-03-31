import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, isValidToolOutput } from "./format";

interface CreateGoalResult {
  success: boolean;
  goal: {
    id: string;
    name: string;
    targetAmount: number;
    targetAmountFormatted: string;
    currentAmount: number;
    progressPercent: number;
  };
}

export function CreateGoalCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("goal" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateGoalResult;
  return (
    <Card size="sm" className="max-w-sm">
      <CardContent>
        <div className="py-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium truncate">{data.goal.name}</span>
            <span className="tabular-nums text-muted-foreground text-xs shrink-0 ml-3">
              {formatCurrency(0)} / {formatCurrency(data.goal.targetAmount)}
            </span>
          </div>
          <ProgressBar
            value={0}
            className="mt-1.5 h-1.5 overflow-hidden"
            barClassName="bg-primary"
          />
          <p className="mt-0.5 text-xs text-muted-foreground text-right">0%</p>
        </div>
      </CardContent>
    </Card>
  );
}
