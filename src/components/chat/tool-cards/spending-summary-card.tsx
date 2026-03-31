import { CategorySummaryCard } from "./category-summary-card";

const SPENDING_CONFIG = {
  title: "Spending",
  route: "/expenses",
  totalField: "totalSpending",
  colorClass: "text-negative",
};

export function SpendingSummaryCard({ output }: { output: unknown }) {
  return <CategorySummaryCard output={output} config={SPENDING_CONFIG} />;
}
