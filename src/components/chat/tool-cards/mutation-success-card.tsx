import { Card, CardContent } from "@/components/ui/card";
import { isValidToolOutput } from "./format";

const mutationLabels: Record<string, string> = {
  update_account: "Account updated",
  update_transaction: "Transaction updated",
  delete_transaction: "Transaction deleted",
  update_budget: "Budget updated",
  update_goal: "Goal updated",
  fund_goal: "Goal funded",
  withdraw_from_goal: "Withdrawn from goal",
};

export function MutationSuccessCard({
  output,
  toolName = "unknown",
}: {
  output: unknown;
  toolName?: string;
}) {
  if (!output || typeof output !== "object") return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as {
    success: boolean;
    account?: { name: string };
    budget?: { name: string };
    goal?: { name: string };
  };
  const label = mutationLabels[toolName] ?? "Done";
  const entityName =
    data.account?.name ?? data.budget?.name ?? data.goal?.name;

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="text-sm">
        <span>
          {label}
          {entityName && (
            <> · <span className="font-medium">{entityName}</span></>
          )}
        </span>
      </CardContent>
    </Card>
  );
}
