import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* h1 "Goals" */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-20" />
      </div>

      {/* GoalList content */}
      <div className="space-y-6">
        {/* Subtitle + Add Goal button */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        {/* Goal cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
            >
              {/* CardHeader: name + status badge */}
              <div className="px-4 flex items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              {/* CardContent */}
              <div className="px-4">
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                {/* Progress bar */}
                <Skeleton className="h-2 w-full rounded-full mt-3" />
                <div className="flex justify-end mt-1">
                  <Skeleton className="h-3 w-8" />
                </div>
                {/* Deadline */}
                <Skeleton className="h-3 w-36 mt-1" />
                {/* Quick Fund button */}
                <Skeleton className="h-8 w-full rounded-md mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
