import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCategoryTotals } from "@/lib/services/categories";
import { getRates, convert } from "@/lib/services/fx-rates";
import { CategoryCards } from "@/components/shared/category-cards";
import { AnimateIn } from "@/components/shared/animate-in";
import { getCurrentDate, getMonthKey } from "@/lib/utils/date";

export const metadata: Metadata = { title: "Income Sources | Wallet" };

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const { date } = await searchParams;
  const activeMonth = getMonthKey(date ?? getCurrentDate());
  const currency = session.user.currency;
  const categories = await getCategoryTotals(session.user.id, "income", activeMonth, currency);

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
        <h1 className="text-2xl font-semibold">Income Sources</h1>
      </AnimateIn>
      <CategoryCards
        categories={categories}
        type="income"
        createLabel="Add Source"
        emptyMessage="No income sources yet. Add your first one to get started."
        placeholder="e.g. Salary, Freelance, Dividends"
        currency={currency}
        totalFormatted={totalFormatted}
      />
    </div>
  );
}
