"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate, isValidToolOutput } from "./format";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  targetAmountFormatted: string;
  currentAmount: number;
  currentAmountFormatted: string;
  progressPercent: number;
  deadline: string | null;
  notes: string | null;
}

interface GoalsData {
  goals: Goal[];
  message?: string;
}

export function GoalsCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("goals" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as GoalsData;

  if (data.goals.length === 0) return null;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {data.goals.map((goal) => (
        <Card
          key={goal.id}
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => router.push("/goals")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium truncate">
              {goal.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">
                {goal.currentAmountFormatted}
              </span>
              <span className="text-sm text-muted-foreground">
                of {goal.targetAmountFormatted}
              </span>
            </div>
            <ProgressBar
              value={goal.progressPercent}
              className="mt-3 overflow-hidden"
              barClassName="bg-primary transition-all"
            />
            <p className="mt-1 text-xs text-muted-foreground text-right">
              {goal.progressPercent}%
            </p>
            {goal.deadline && (
              <p className="mt-1 text-xs text-muted-foreground">
                Deadline: {formatDate(goal.deadline)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
