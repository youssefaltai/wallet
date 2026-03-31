import { Skeleton } from "@/components/ui/skeleton";

export default function AccountDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Back button + account name */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-40" />
      </div>

      {/* Account overview card */}
      <div className="rounded-xl ring-1 ring-foreground/10 bg-card py-4 space-y-4">
        <div className="px-4 flex items-center justify-between pb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="px-4 space-y-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Transactions section */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-28" />

        <div className="rounded-md border">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
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
    </div>
  );
}
