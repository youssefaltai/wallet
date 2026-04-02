"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isValidToolOutput } from "./format";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Bank & Cash",
  liability: "Credit & Loans",
};

const MAX_INLINE_ITEMS = 12;

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  isActive: boolean;
  balance: number;
  balanceFormatted: string;
}

interface AccountsData {
  accounts: Account[];
  message?: string;
}

export function AccountsCard({ output }: { output: unknown }) {
  const router = useRouter();
  if (!output || typeof output !== "object") return null;
  if (!("accounts" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as AccountsData;

  if (data.accounts.length === 0) return null;

  const displayedAccounts = data.accounts.slice(0, MAX_INLINE_ITEMS);
  const hasMore = data.accounts.length > MAX_INLINE_ITEMS;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {displayedAccounts.map((account) => (
        <Card
          key={account.id}
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => router.push(`/transactions?account=${account.id}`)}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {account.name}
            </CardTitle>
            <Badge variant="secondary">
              {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {account.balanceFormatted}
            </div>
            {account.institution && (
              <p className="text-xs text-muted-foreground mt-1">
                {account.institution}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
      </div>
      {hasMore && (
        <button
          onClick={() => router.push("/accounts")}
          className="w-full py-2 px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
        >
          View all {data.accounts.length} accounts
        </button>
      )}
    </div>
  );
}
