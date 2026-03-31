"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isValidToolOutput } from "./format";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Bank & Cash",
  liability: "Credit & Loans",
};

interface CreateAccountResult {
  success: boolean;
  account: {
    id: string;
    name: string;
    type: string;
    institution: string | null;
    currency: string;
    balance: number;
    balanceFormatted: string;
  };
}

export function CreateAccountCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("account" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateAccountResult;
  const a = data.account;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => router.push(`/accounts/${a.id}`)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{a.name}</CardTitle>
        <Badge variant="secondary">
          {ACCOUNT_TYPE_LABELS[a.type] ?? a.type}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{a.balanceFormatted}</div>
        {a.institution && (
          <p className="text-xs text-muted-foreground mt-1">
            {a.institution}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
