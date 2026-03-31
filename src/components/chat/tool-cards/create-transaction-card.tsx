import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, isValidToolOutput } from "./format";

interface CreateTransactionResult {
  success: boolean;
  transaction: {
    id: string;
    amount: number;
    amountFormatted: string;
    description: string;
    category: string | null;
    date: string;
  };
}

export function CreateTransactionCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("transaction" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateTransactionResult;
  const t = data.transaction;

  return (
    <Card size="sm" className="max-w-sm">
      <CardContent>
        <div className="py-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium truncate">{t.description}</span>
            <span
              className={`tabular-nums shrink-0 font-medium ${t.amount >= 0 ? "text-positive" : "text-negative"}`}
            >
              {formatCurrency(t.amount)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatDate(t.date)}
            {t.category && <span> · {t.category}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
