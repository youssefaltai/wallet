import { Card, CardContent } from "@/components/ui/card";
import { isValidToolOutput } from "./format";

interface CreateAccountResult {
  success: boolean;
  account: { id: string; name: string; type: string };
}

export function CreateAccountCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("account" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as CreateAccountResult;
  return (
    <Card size="sm" className="max-w-sm">
      <CardContent>
        <div className="flex items-baseline justify-between py-1 text-sm">
          <div className="min-w-0">
            <span className="font-medium">{data.account.name}</span>
            <span className="text-muted-foreground ml-1.5 text-xs">
              {data.account.type}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
