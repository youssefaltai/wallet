import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
