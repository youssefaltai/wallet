import { CategorySummaryCard } from "./category-summary-card";

const INCOME_CONFIG = {
  totalField: "totalIncome",
  colorClass: "text-positive",
  emptyMessage: "No income in this period.",
};

export function IncomeSummaryCard({ output }: { output: unknown }) {
  return <CategorySummaryCard output={output} config={INCOME_CONFIG} />;
}
