import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCurrency, formatDate, isValidToolOutput } from "./format";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetAmountFormatted: string;
  currentAmount: number;
  currentAmountFormatted: string;
  progressPercent: number;
  deadline: string | null;
  status: string;
  notes: string | null;
}

interface GoalsData {
  goals: Goal[];
  message?: string;
}

const statusDot: Record<string, string> = {
  active: "bg-positive",
  completed: "bg-primary",
  paused: "bg-muted-foreground/50",
};

export function GoalsCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("goals" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as GoalsData;

  if (data.goals.length === 0) {
    return (
      <Card size="sm" className="max-w-sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data.message ?? "No goals set up."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-3">
        {data.goals.map((g) => (
          <div key={g.id} className="py-1">
            <div className="flex items-baseline justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`size-1.5 rounded-full shrink-0 ${statusDot[g.status] ?? "bg-muted-foreground/50"}`}
                />
                <span className="font-medium truncate">{g.name}</span>
              </div>
              <span className="font-medium tabular-nums ml-4 shrink-0">
                {formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}
              </span>
            </div>
            <ProgressBar
              value={g.progressPercent}
              className="mt-1.5 h-1.5 overflow-hidden"
              barClassName="bg-primary transition-all"
            />
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-xs text-muted-foreground">
                {g.deadline && <>by {formatDate(g.deadline)}</>}
                {g.deadline && g.notes && " · "}
                {g.notes && <>{g.notes}</>}
                {!g.deadline && !g.notes && g.status}
              </p>
              <p className="text-xs text-muted-foreground">{g.progressPercent}%</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
