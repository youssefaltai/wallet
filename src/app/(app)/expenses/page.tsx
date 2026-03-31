import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCategoryTotals } from "@/lib/services/categories";
import { getBudgetStatuses } from "@/lib/services/budgets";
import { getRates, convert } from "@/lib/services/fx-rates";
import { CategoryCards } from "@/components/shared/category-cards";
import { AnimateIn } from "@/components/shared/animate-in";
import { getCurrentDate, getMonthKey, getMonthRange } from "@/lib/utils/date";

export const metadata: Metadata = { title: "Expense Categories | Wallet" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const { date } = await searchParams;
  const currentDate = date ?? getCurrentDate();
  const activeMonth = getMonthKey(currentDate);
  const { startDate: periodStart, endDate: periodEnd } = getMonthRange(currentDate);
  const currency = session.user.currency;

  const [categories, budgets] = await Promise.all([
    getCategoryTotals(session.user.id, "expense", activeMonth, currency),
    getBudgetStatuses(session.user.id, { periodStart, periodEnd }),
  ]);

  // Convert category totals to base currency for the aggregate
  const needsConversion = categories.some((c) => c.currency !== currency);
  const rates = needsConversion ? await getRates() : null;
  const totalAmount = categories.reduce((sum, c) => {
    const val = c.currency === currency ? c.total : convert(c.total, c.currency, currency, rates!);
    return sum + val;
  }, 0);
  const totalFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(totalAmount);

  return (
    <div className="p-6 space-y-6">
      <AnimateIn>
        <h1 className="text-2xl font-semibold">Expense Categories</h1>
      </AnimateIn>
      <CategoryCards
        categories={categories}
        type="expense"
        createLabel="Add Category"
        emptyMessage="No expense categories yet. Add your first one to get started."
        placeholder="e.g. Groceries, Rent, Dining"
        currency={currency}
        totalFormatted={totalFormatted}
        budgets={budgets}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />
    </div>
  );
}
