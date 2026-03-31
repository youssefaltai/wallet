import { CategorySummaryCard } from "./category-summary-card";

const INCOME_CONFIG = {
  title: "Income",
  route: "/income",
  totalField: "totalIncome",
  colorClass: "text-positive",
};

export function IncomeSummaryCard({ output }: { output: unknown }) {
  return <CategorySummaryCard output={output} config={INCOME_CONFIG} />;
}
