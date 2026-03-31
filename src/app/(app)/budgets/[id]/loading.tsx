import { Skeleton } from "@/components/ui/skeleton";

export default function BudgetDetailLoading() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-20" />
      <div className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="rounded-md border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3 border-b last:border-b-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
