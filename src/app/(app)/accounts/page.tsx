import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccountsWithBalances } from "@/lib/services/accounts";
import { getRates, convert } from "@/lib/services/fx-rates";
import { AccountList } from "./account-list";
import { AnimateIn } from "@/components/shared/animate-in";

export const metadata: Metadata = { title: "Accounts | Wallet" };

export default async function AccountsPage() {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const currency = session.user.currency;
  const accounts = await getAccountsWithBalances(session.user.id, currency);

  // Convert account balances to base currency for the total
  const needsConversion = accounts.some((a) => a.currency !== currency);
  const rates = needsConversion ? await getRates() : null;

  const totalBalance = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => {
      const bal = a.currency === currency ? a.balance : convert(a.balance, a.currency, currency, rates!);
      return sum + bal;
    }, 0);

  const totalFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(totalBalance);

  return (
    <div className="p-6 space-y-6">
      <AnimateIn>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Accounts</h1>
        </div>
      </AnimateIn>
      <AnimateIn delay={50}>
        <AccountList accounts={accounts} currency={currency} totalFormatted={totalFormatted} />
      </AnimateIn>
    </div>
  );
}
