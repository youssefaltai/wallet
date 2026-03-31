"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isValidToolOutput } from "./format";

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
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("goal" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateGoalResult;
  const g = data.goal;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push("/goals")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {g.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">
            {g.targetAmountFormatted}
          </span>
        </div>
        <ProgressBar
          value={0}
          className="mt-3 overflow-hidden"
          barClassName="bg-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground text-right">0%</p>
      </CardContent>
    </Card>
  );
}
