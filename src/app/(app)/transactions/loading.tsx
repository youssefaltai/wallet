import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* h1 "Transactions" */}
      <Skeleton className="h-8 w-40" />

      {/* TransactionFilters: search input + filter button */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-full max-w-sm rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* TransactionList: Add Transaction button + table */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>

        {/* Transaction table */}
        <div className="rounded-md border">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32 flex-1" />
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
