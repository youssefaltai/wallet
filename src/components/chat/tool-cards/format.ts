import { formatDate, formatDateRange } from "@/lib/utils/format-date";
export { formatDate };

export function formatPeriod(period: { startDate: string; endDate: string }): string {
  return formatDateRange(period.startDate, period.endDate);
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export interface CategorySummary {
  category: string;
  total: number;
  transactionCount: number;
}

export function isValidToolOutput(output: unknown): output is Record<string, unknown> {
  if (!output || typeof output !== "object") return false;
  if ("success" in output && !(output as Record<string, unknown>).success) return false;
  return true;
}
