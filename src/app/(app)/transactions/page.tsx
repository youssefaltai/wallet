import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { parseMonthParam } from "@/lib/utils/parse-month";
import { redirect } from "next/navigation";
import {
  getTransactions,
  getTransactionCount,
} from "@/lib/services/transactions";
import { getAccountsWithBalances } from "@/lib/services/accounts";
import {
  getExpenseCategories,
  getIncomeCategories,
} from "@/lib/services/categories";
import { TransactionList } from "./transaction-list";
import { TransactionFilters } from "./transaction-filters";
import { Pagination } from "@/components/ui/pagination";
import { AnimateIn } from "@/components/shared/animate-in";

export const metadata: Metadata = { title: "Transactions | Wallet" };

const PAGE_SIZE = 20;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const userId = session.user.id;
  const currency = session.user.currency;

  const parsed = parseMonthParam(params.date);
  const startDate = params.from ?? parsed.startDate;
  const endDate = params.to ?? parsed.endDate;

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filters = {
    userId,
    accountId: params.account,
    categoryAccountId: params.category,
    type: params.type as "expense" | "income" | "transfer" | undefined,
    startDate,
    endDate,
    search: params.q,
    currency,
  };

  const [txns, totalCount, accounts, expenseCategories, incomeCategories] =
    await Promise.all([
      getTransactions({ ...filters, limit: PAGE_SIZE, offset }),
      getTransactionCount(filters),
      getAccountsWithBalances(userId, currency),
      getExpenseCategories(userId),
      getIncomeCategories(userId),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  //
  // Build href helper that preserves existing search params
  function buildHref(targetPage: number) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "page" && value != null) sp.set(key, value);
    }
    if (targetPage > 1) sp.set("page", String(targetPage));
    const qs = sp.toString();
    return `/transactions${qs ? `?${qs}` : ""}`;
  }

  const prevHref = page > 1 ? buildHref(page - 1) : undefined;
  const nextHref = page < totalPages ? buildHref(page + 1) : undefined;

  return (
    <div className="p-6 space-y-6">
      <AnimateIn>
        <h1 className="text-2xl font-semibold">Transactions</h1>
      </AnimateIn>
      <AnimateIn delay={50}>
        <TransactionFilters
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      </AnimateIn>
      <AnimateIn delay={100}>
        <TransactionList
          transactions={txns}
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
        />
      </AnimateIn>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={PAGE_SIZE}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </div>
  );
}
