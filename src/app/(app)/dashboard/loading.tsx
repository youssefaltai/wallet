import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* h1 "Dashboard" */}
      <Skeleton className="h-8 w-36" />

      {/* Summary stat cards - 5 cards in grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl ring-1 ring-foreground/10 bg-card py-3 space-y-3"
          >
            <div className="px-3 pb-1">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="px-3">
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Accounts section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
            >
              <div className="px-4 flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="px-4">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-3 w-20 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budgets section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
            >
              <div className="px-4 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="px-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
            >
              <div className="px-4 flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <div className="px-4">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full mt-3" />
                <div className="flex justify-end mt-1">
                  <Skeleton className="h-3 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="rounded-md border">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
