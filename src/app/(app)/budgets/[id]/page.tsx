import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getBudgetById } from "@/lib/services/budgets";
import { getTransactions } from "@/lib/services/transactions";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AnimateIn } from "@/components/shared/animate-in";
import { formatDateFull, formatRelativeDateTime, formatDateRange } from "@/lib/utils/format-date";

export const metadata: Metadata = { title: "Budget Details | Wallet" };

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const currency = session.user.currency;

  const budget = await getBudgetById(id, session.user.id, currency);
  if (!budget) notFound();

  // Fetch expense transactions matching this budget's category within the date range
  const filters: Parameters<typeof getTransactions>[0] = {
    userId: session.user.id,
    startDate: budget.startDate,
    endDate: budget.endDate,
    categoryAccountId: budget.categoryAccountId,
    limit: 200,
    currency,
  };

  const transactions = (await getTransactions(filters)).filter(
    (txn) => txn.type === "expense"
  );

  const barColor =
    budget.percentUsed >= 90
      ? "bg-negative"
      : budget.percentUsed >= 75
        ? "bg-warning"
        : "bg-positive";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <AnimateIn>
        <div className="flex items-center gap-2">
          <Link href="/budgets">
            <Button variant="ghost" size="sm">
              &larr; Budgets
            </Button>
          </Link>
        </div>
      </AnimateIn>

      <AnimateIn delay={50}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">{budget.name}</CardTitle>
            <Badge variant="secondary">{budget.categoryName}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">
                {budget.spentFormatted}
              </span>
              <span className="text-sm text-muted-foreground">
                of {budget.budgetAmountFormatted}
              </span>
            </div>

            <ProgressBar
              value={budget.percentUsed}
              className="overflow-hidden"
              barClassName={`${barColor} transition-all`}
            />

            <div className="flex items-baseline justify-between text-sm text-muted-foreground">
              <span>
                {budget.remaining >= 0
                  ? `${budget.remainingFormatted} remaining`
                  : `${new Intl.NumberFormat("en-US", { style: "currency", currency: budget.currency }).format(Math.abs(budget.remaining))} over budget`}
                {" \u2013 "}
                {Math.round(budget.percentUsed)}% used
              </span>
              <span>
                {formatDateRange(budget.startDate, budget.endDate)}
              </span>
            </div>
          </CardContent>
        </Card>
      </AnimateIn>

      <AnimateIn delay={150}>
        <h2 className="text-lg font-semibold">
          Transactions ({transactions.length})
        </h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">
            No transactions match this budget yet.
          </p>
        ) : (
          <div className="rounded-md border mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn, i) => (
                  <TableRow key={txn.id} className="animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                    <TableCell className="whitespace-nowrap">
                      {formatRelativeDateTime(txn.date)}
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>
                      {txn.categoryName ? (
                        <Badge variant="secondary">{txn.categoryName}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {txn.accountName}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        txn.type === "expense" ? "text-negative" : txn.type === "income" ? "text-positive" : ""
                      }`}
                    >
                      {txn.signedAmountFormatted}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AnimateIn>
    </div>
  );
}
