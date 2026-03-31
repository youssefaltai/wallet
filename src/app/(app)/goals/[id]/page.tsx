import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getGoalById } from "@/lib/services/goals";
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
import { formatDateFull, formatDate } from "@/lib/utils/format-date";

export const metadata: Metadata = { title: "Goal Details | Wallet" };

const statusBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  completed: "secondary",
  paused: "outline",
};

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const currency = session.user.currency;

  const goal = await getGoalById(id, session.user.id, currency);
  if (!goal) notFound();

  const transactions = await getTransactions({
    userId: session.user.id,
    accountId: goal.accountId,
    limit: 100,
    currency,
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <AnimateIn>
        <div className="flex items-center gap-2">
          <Link href="/goals">
            <Button variant="ghost" size="sm">
              &larr; Goals
            </Button>
          </Link>
        </div>
      </AnimateIn>

      <AnimateIn delay={50}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">{goal.name}</CardTitle>
            <Badge variant={statusBadgeVariant[goal.status] ?? "outline"}>
              {goal.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">
                {goal.currentAmountFormatted}
              </span>
              <span className="text-sm text-muted-foreground">
                of {goal.targetAmountFormatted}
              </span>
            </div>

            <ProgressBar
              value={goal.progressPercent}
              className="overflow-hidden"
              barClassName="bg-primary transition-all"
            />
            <p className="text-sm text-muted-foreground text-right">
              {goal.progressPercent}% complete
            </p>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {goal.deadline && (
                <p>
                  Deadline:{" "}
                  {formatDateFull(goal.deadline)}
                </p>
              )}
              {goal.notes && <p>{goal.notes}</p>}
            </div>
          </CardContent>
        </Card>
      </AnimateIn>

      <AnimateIn delay={150}>
        <h2 className="text-lg font-semibold">Transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">
            No transactions for this goal yet.
          </p>
        ) : (
          <div className="rounded-md border mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn, i) => (
                  <TableRow key={txn.id} className="animate-fade-up" style={{ animationDelay: `${i * 20}ms` }}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(txn.date)}
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
