import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 rounded-md" />
      </div>
    </div>
  );
}
