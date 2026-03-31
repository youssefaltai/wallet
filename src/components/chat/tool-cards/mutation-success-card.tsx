"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidToolOutput } from "./format";

const entityRoutes: Record<string, string> = {
  update_account: "/accounts",
  update_transaction: "/transactions",
  delete_transaction: "/transactions",
  update_budget: "/budgets",
  update_goal: "/goals",
  fund_goal: "/goals",
  withdraw_from_goal: "/goals",
};

export function MutationSuccessCard({
  output,
  toolName = "unknown",
}: {
  output: unknown;
  toolName?: string;
}) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as {
    success: boolean;
    account?: { id: string; name: string };
    budget?: { id: string; name: string };
    goal?: { id: string; name: string };
  };

  const entityName =
    data.account?.name ?? data.budget?.name ?? data.goal?.name;
  if (!entityName) return null;

  const route = entityRoutes[toolName] ?? "/dashboard";

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push(route)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{entityName}</CardTitle>
      </CardHeader>
    </Card>
  );
}
