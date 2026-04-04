import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { parseMonthParam } from "@/lib/utils/parse-month";
import { redirect } from "next/navigation";
import { getAccountsWithBalances, isLiability } from "@/lib/services/accounts";
import { getCashFlow, getTransactions } from "@/lib/services/transactions";
import { getBudgetStatuses } from "@/lib/services/budgets";
import { getGoals } from "@/lib/services/goals";
import { getRatesWithMeta, convert } from "@/lib/services/fx-rates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { AnimateIn } from "@/components/shared/animate-in";
import { NetWorthValue } from "./net-worth-value";
import {
  DashboardAccountCards,
  DashboardBudgetCards,
  DashboardGoalCards,
} from "./dashboard-cards";
import { DashboardRecentTransactions } from "./recent-transactions";

export const metadata: Metadata = { title: "Dashboard | Wallet" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const userId = session.user.id;

  const { startDate, endDate } = parseMonthParam(params.date);
  const currency = session.user.currency;

  const [accounts, recentTxns, cashFlow, budgets, goals] = await Promise.all([
    getAccountsWithBalances(userId, currency),
    getTransactions({ userId, startDate, endDate, limit: 10, currency }),
    getCashFlow(userId, startDate, endDate, currency),
    getBudgetStatuses(userId, { periodStart: startDate, periodEnd: endDate, currency }),
    getGoals(userId),
  ]);

  const activeAccounts = accounts.filter((a) => a.isActive);

  // Convert account balances to base currency for aggregation
  const needsConversion = accounts.some((a) => a.currency !== currency);
  const ratesMeta = needsConversion ? await getRatesWithMeta() : null;
  const rates = ratesMeta?.rates ?? null;

  function toBase(a: { balance: number; currency: string }) {
    if (a.currency === currency) return a.balance;
    return convert(a.balance, a.currency, currency, rates!);
  }

  const totalAssets = accounts
    .filter((a) => !isLiability(a.type))
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + toBase(a), 0);

  const totalLiabilities = accounts
    .filter((a) => isLiability(a.type))
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + toBase(a), 0);

  const netWorth = totalAssets - totalLiabilities;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(n);

  return (
    <div className="p-6 space-y-6">
      <AnimateIn>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </AnimateIn>

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Net Worth + breakdown */}
        <AnimateIn delay={50}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Worth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NetWorthValue
                value={netWorth}
                currency={currency}
                isApproximate={needsConversion}
                ratesFetchedAt={ratesMeta?.fetchedAt ?? null}
              />

              {/* Assets / Liabilities split bar */}
              <div className="space-y-2">
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  {totalAssets + totalLiabilities > 0 && (
                    <>
                      <div
                        className="bg-positive transition-all duration-700"
                        style={{
                          width: `${(totalAssets / (totalAssets + totalLiabilities)) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-negative transition-all duration-700"
                        style={{
                          width: `${(totalLiabilities / (totalAssets + totalLiabilities)) * 100}%`,
                        }}
                      />
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-positive" />
                    <span className="text-muted-foreground">Assets</span>
                    <span className="font-semibold">{fmt(totalAssets)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fmt(totalLiabilities)}</span>
                    <span className="text-muted-foreground">Liabilities</span>
                    <span className="size-2.5 rounded-full bg-negative" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimateIn>

        {/* Cash Flow */}
        <AnimateIn delay={150}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cash Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">
                {cashFlow.income - cashFlow.expenses >= 0 ? "+" : ""}
                {fmt(cashFlow.income - cashFlow.expenses)}
              </div>

              {/* Income / Expenses comparison bars */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-positive" />
                      <span className="text-muted-foreground">Income</span>
                    </div>
                    <span className="font-semibold">{fmt(cashFlow.income)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-positive transition-all duration-700"
                      style={{
                        width: `${Math.max(cashFlow.income, cashFlow.expenses) > 0 ? (cashFlow.income / Math.max(cashFlow.income, cashFlow.expenses)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-negative" />
                      <span className="text-muted-foreground">Expenses</span>
                    </div>
                    <span className="font-semibold">{fmt(cashFlow.expenses)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-negative transition-all duration-700"
                      style={{
                        width: `${Math.max(cashFlow.income, cashFlow.expenses) > 0 ? (cashFlow.expenses / Math.max(cashFlow.income, cashFlow.expenses)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimateIn>
      </div>

      {/* ── Main content grid ─────────────────────────────────────────── */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* ── Accounts ───────────────────────────────────────────────── */}
        <AnimateIn delay={300}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Accounts</CardTitle>
              <Link
                href="/accounts"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {activeAccounts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No accounts yet.{" "}
                  <Link href="/accounts" className="text-primary hover:underline">
                    Add one
                  </Link>
                </p>
              ) : (
                <DashboardAccountCards accounts={activeAccounts} baseDelay={320} dateParam={params.date ?? null} />
              )}
            </CardContent>
          </Card>
        </AnimateIn>

        {/* ── Budgets ────────────────────────────────────────────────── */}
        <AnimateIn delay={400}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Budgets</CardTitle>
              <Link
                href="/budgets"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {budgets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No budgets this period.{" "}
                  <Link href="/budgets" className="text-primary hover:underline">
                    Create one
                  </Link>
                </p>
              ) : (
                <DashboardBudgetCards budgets={budgets} baseDelay={420} currency={currency} />
              )}
            </CardContent>
          </Card>
        </AnimateIn>

        {/* ── Goals ──────────────────────────────────────────────────── */}
        <AnimateIn delay={500}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Goals</CardTitle>
              <Link
                href="/goals"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No goals yet.{" "}
                  <Link href="/goals" className="text-primary hover:underline">
                    Create one
                  </Link>
                </p>
              ) : (
                <DashboardGoalCards goals={goals} baseDelay={520} />
              )}
            </CardContent>
          </Card>
        </AnimateIn>

        {/* ── Recent Transactions ──────────────────────────────────── */}
        <AnimateIn delay={600}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
              <Link
                href="/transactions"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <DashboardRecentTransactions transactions={recentTxns} />
            </CardContent>
          </Card>
        </AnimateIn>
      </div>
    </div>
  );
}
