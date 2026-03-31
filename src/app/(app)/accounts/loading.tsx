import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* h1 "Accounts" */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
      </div>

      {/* AccountList content */}
      <div className="space-y-6">
        {/* Total balance + Add Account button */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        {/* Bank & Cash group */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
              >
                <div className="px-4 flex items-center justify-between pb-2">
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="px-4">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-20 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credit & Loans group */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4"
              >
                <div className="px-4 flex items-center justify-between pb-2">
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="px-4">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-20 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
