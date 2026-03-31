import { Skeleton } from "@/components/ui/skeleton";

export default function GoalDetailLoading() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Skeleton className="h-8 w-20 rounded-md" />

      {/* Goal overview card */}
      <div className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4">
        {/* CardHeader: title + status badge */}
        <div className="px-4 flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        {/* CardContent */}
        <div className="px-4 space-y-4">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-end">
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Transactions heading */}
      <Skeleton className="h-6 w-28" />

      {/* Transactions table */}
      <div className="rounded-md border">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
