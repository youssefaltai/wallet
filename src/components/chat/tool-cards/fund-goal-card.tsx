"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isValidToolOutput } from "./format";

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
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("goal" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as GoalFundResult;
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
            {g.currentAmountFormatted}
          </span>
          <span className="text-sm text-muted-foreground">
            of {g.targetAmountFormatted}
          </span>
        </div>
        <ProgressBar
          value={g.progressPercent}
          className="mt-3 overflow-hidden"
          barClassName="bg-primary transition-all"
        />
        <p className="mt-1 text-xs text-muted-foreground text-right">
          {g.progressPercent}%
        </p>
      </CardContent>
    </Card>
  );
}
