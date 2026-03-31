import { CategorySummaryCard } from "./category-summary-card";

const SPENDING_CONFIG = {
  totalField: "totalSpending",
  colorClass: "text-negative",
  emptyMessage: "No spending in this period.",
};

export function SpendingSummaryCard({ output }: { output: unknown }) {
  return <CategorySummaryCard output={output} config={SPENDING_CONFIG} />;
}
