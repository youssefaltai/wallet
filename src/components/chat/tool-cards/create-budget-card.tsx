"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isValidToolOutput } from "./format";

interface CreateBudgetResult {
  success: boolean;
  budget: { id: string; name: string; amount: number; amountFormatted: string };
}

export function CreateBudgetCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("budget" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateBudgetResult;
  const b = data.budget;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push("/budgets")}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{b.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">
            {b.amountFormatted}
          </span>
        </div>
        <ProgressBar
          value={0}
          className="overflow-hidden"
          barClassName="bg-positive"
        />
        <p className="text-xs text-muted-foreground">
          {b.amountFormatted} left · 0% used
        </p>
      </CardContent>
    </Card>
  );
}
