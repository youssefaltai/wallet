import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, isValidToolOutput } from "./format";

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
  if (!output || typeof output !== "object") return null;
  if (!("accounts" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as AccountsData;

  if (data.accounts.length === 0) {
    return (
      <Card size="sm" className="max-w-sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {data.message ?? "No accounts yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent className="space-y-1">
        {data.accounts.map((a) => (
          <div
            key={a.id}
            className="flex items-baseline justify-between py-1 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium">{a.name}</span>
              <span className="text-muted-foreground ml-1.5 text-xs">
                {a.institution ? `${a.institution} · ` : ""}
                {a.type}
              </span>
            </div>
            <span className="font-medium tabular-nums ml-4 shrink-0">
              {formatCurrency(a.balance)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
