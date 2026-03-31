"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { formatCurrency, isValidToolOutput } from "./format";

interface ConvertData {
  amount: number;
  from: string;
  to: string;
  convertedAmount: number;
  rate: number;
}

export function ConvertCurrencyCard({ output }: { output: unknown }) {
  if (!output || typeof output !== "object") return null;
  if (!("convertedAmount" in output)) return null;
  if (!isValidToolOutput(output)) return null;
  const data = output as ConvertData;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Currency Conversion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold tabular-nums">
            {formatCurrency(data.amount, data.from)}
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="text-2xl font-bold tabular-nums">
            {formatCurrency(data.convertedAmount, data.to)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          1 {data.from} = {data.rate} {data.to}
        </p>
      </CardContent>
    </Card>
  );
}
