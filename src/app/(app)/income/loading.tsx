import { Skeleton } from "@/components/ui/skeleton";

export default function IncomeLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* h1 "Income Sources" */}
      <Skeleton className="h-8 w-44" />

      {/* CategoryCards content */}
      <div className="space-y-6">
        {/* Total earned + Add Source button */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        {/* Category cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
            >
              {/* CardHeader: source name + icon */}
              <div className="px-4 flex items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              {/* CardContent */}
              <div className="px-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-7 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full invisible" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
