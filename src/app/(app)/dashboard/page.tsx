import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { parseMonthParam } from "@/lib/utils/parse-month";
import { redirect } from "next/navigation";
import { getAccountsWithBalances, isLiability } from "@/lib/services/accounts";
import { getCashFlow, getTransactions } from "@/lib/services/transactions";
import { getBudgetStatuses } from "@/lib/services/budgets";
import { getGoals } from "@/lib/services/goals";
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

  const { startDate, endDate, monthKey } = parseMonthParam(params.date);
  const currency = session.user.currency;

  const [accounts, recentTxns, cashFlow, budgets, goals] = await Promise.all([
    getAccountsWithBalances(userId, currency),
    getTransactions({ userId, startDate, endDate, limit: 10, currency }),
    getCashFlow(userId, startDate, endDate),
    getBudgetStatuses(userId, { periodStart: startDate, periodEnd: endDate, currency }),
    getGoals(userId, { deadlineMonth: monthKey, currency }),
  ]);

  const activeAccounts = accounts.filter((a) => a.isActive);
  const activeBudgets = budgets.filter((b) => b.isActive);
  const activeGoals = goals.filter((g) => g.status === "active");

  const totalAssets = accounts
    .filter((a) => !isLiability(a.type))
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.balance, 0);

  const totalLiabilities = accounts
    .filter((a) => isLiability(a.type))
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.balance, 0);

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

      {/* ── Summary stat cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <AnimateIn delay={50}>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Net Worth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NetWorthValue value={netWorth} currency={currency} />
            </CardContent>
          </Card>
        </AnimateIn>
        <AnimateIn delay={100}>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-positive">
                {fmt(totalAssets)}
              </div>
            </CardContent>
          </Card>
        </AnimateIn>
        <AnimateIn delay={150}>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Liabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-negative">
                {fmt(totalLiabilities)}
              </div>
            </CardContent>
          </Card>
        </AnimateIn>
        <AnimateIn delay={200}>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-positive">
                {fmt(cashFlow.income)}
              </div>
            </CardContent>
          </Card>
        </AnimateIn>
        <AnimateIn delay={250}>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-negative">
                {fmt(cashFlow.expenses)}
              </div>
            </CardContent>
          </Card>
        </AnimateIn>
      </div>

      {/* ── Accounts ─────────────────────────────────────────────────── */}
      <AnimateIn delay={300}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Accounts</h2>
          <Link
            href="/accounts"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {activeAccounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No accounts yet.{" "}
            <Link href="/accounts" className="text-primary hover:underline">
              Add one
            </Link>
          </p>
        ) : (
          <DashboardAccountCards accounts={activeAccounts} baseDelay={320} />
        )}
      </AnimateIn>

      {/* ── Budgets ────────────────────────────────────────────────────── */}
      <AnimateIn delay={400}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Budgets</h2>
          <Link
            href="/budgets"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {activeBudgets.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No active budgets this period.{" "}
            <Link href="/budgets" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        ) : (
          <DashboardBudgetCards budgets={activeBudgets} baseDelay={420} currency={currency} />
        )}
      </AnimateIn>

      {/* ── Goals ──────────────────────────────────────────────────────── */}
      <AnimateIn delay={500}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Goals</h2>
          <Link
            href="/goals"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {activeGoals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No active goals.{" "}
            <Link href="/goals" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        ) : (
          <DashboardGoalCards goals={activeGoals} baseDelay={520} />
        )}
      </AnimateIn>

      {/* ── Recent Transactions ────────────────────────────────────────── */}
      <AnimateIn delay={600}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <Link
            href="/transactions"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <DashboardRecentTransactions transactions={recentTxns} />
      </AnimateIn>
    </div>
  );
}
