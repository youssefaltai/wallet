"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidToolOutput } from "./format";

const toolRoutes: Record<string, string> = {
  batch_create_transactions: "/transactions",
  batch_delete_transactions: "/transactions",
  batch_create_budgets: "/budgets",
  batch_fund_goals: "/goals",
  batch_create_goals: "/goals",
  batch_create_accounts: "/accounts",
};

const toolLabels: Record<string, string> = {
  batch_create_transactions: "transactions recorded",
  batch_delete_transactions: "transactions deleted",
  batch_create_budgets: "budgets created",
  batch_fund_goals: "goals funded",
  batch_create_goals: "goals created",
  batch_create_accounts: "accounts created",
};

interface BatchResult {
  success: boolean;
  count?: number;
  totalAmount?: number;
  totalAmountFormatted?: string;
  failedIndex?: number;
  error?: string;
}

export function BatchResultCard({
  output,
  toolName = "unknown",
}: {
  output: unknown;
  toolName?: string;
}) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as unknown as BatchResult;

  const route = toolRoutes[toolName] ?? "/dashboard";
  const label = toolLabels[toolName] ?? "items processed";

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push(route)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {data.count} {label}
        </CardTitle>
      </CardHeader>
      {data.totalAmountFormatted && (
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {data.totalAmountFormatted}
          </div>
          <p className="text-xs text-muted-foreground mt-1">total</p>
        </CardContent>
      )}
    </Card>
  );
}
