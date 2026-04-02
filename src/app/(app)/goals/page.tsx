import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { getCurrentDate } from "@/lib/utils/date";
import { redirect } from "next/navigation";
import { getGoals } from "@/lib/services/goals";
import { getAccountsWithBalances } from "@/lib/services/accounts";
import { GoalList } from "./goal-list";

export const metadata: Metadata = { title: "Goals | Wallet" };

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  const currency = session.user.currency;
  const today = getCurrentDate();
  const selectedDate = params.date ?? today;
  const [allGoals, accounts] = await Promise.all([
    getGoals(session.user.id),
    getAccountsWithBalances(session.user.id, currency),
  ]);

  // Filter out goals with deadlines before the selected date
  const goals = allGoals.filter(
    (goal) => !goal.deadline || goal.deadline >= selectedDate
  );

  // Only show active asset accounts as funding sources
  const fundingAccounts = accounts.filter((a) => a.isActive && !["credit card", "loan", "mortgage", "debt"].includes(a.type.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goals</h1>
      </div>
      <GoalList goals={goals} fundingAccounts={fundingAccounts} />
    </div>
  );
}
