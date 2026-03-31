import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cachedAuth } from "@/lib/auth";
import { getAccountWithBalance } from "@/lib/services/accounts";
import { getTransactions, getTransactionCount } from "@/lib/services/transactions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { AnimateIn } from "@/components/shared/animate-in";
import { formatDate } from "@/lib/utils/format-date";

export const metadata: Metadata = { title: "Account Details | Wallet" };

const PAGE_SIZE = 20;

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const userId = session.user.id;

  const currency = session.user.currency;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filters = { userId, accountId: id, currency };

  const [account, transactions, totalCount] = await Promise.all([
    getAccountWithBalance(id, userId, currency),
    getTransactions({ ...filters, limit: PAGE_SIZE, offset }),
    getTransactionCount(filters),
  ]);

  if (!account) notFound();

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function buildHref(targetPage: number) {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/accounts/${id}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="p-6 space-y-6">
      <AnimateIn>
        <div className="flex items-center gap-4">
          <Link href="/accounts">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
        </div>
      </AnimateIn>

      <AnimateIn delay={50}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Account Overview</CardTitle>
          <Badge variant="secondary">
            {account.type === "asset" ? "Bank & Cash" : account.type === "liability" ? "Credit & Loans" : account.type}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold">{account.balanceFormatted}</div>
          {account.institution && (
            <p className="text-sm text-muted-foreground">
              {account.institution}
            </p>
          )}
        </CardContent>
      </Card>
      </AnimateIn>

      <AnimateIn delay={100}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Transactions</h2>

        {transactions.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            No transactions for this account yet.
          </p>
        ) : (
          <div className="rounded-md border">
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
                  <TableRow
                    key={txn.id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(txn.date)}
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>
                      {txn.categoryName ? (
                        <Badge variant="secondary">{txn.categoryName}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          —
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
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          buildHref={buildHref}
        />
      </div>
      </AnimateIn>
    </div>
  );
}
