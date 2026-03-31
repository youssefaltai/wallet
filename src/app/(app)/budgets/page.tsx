import { redirect } from "next/navigation";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const params = date ? `?date=${date}` : "";
  redirect(`/expenses${params}`);
}
