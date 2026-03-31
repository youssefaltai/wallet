import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <Skeleton className="h-8 w-32" />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-1/2 ml-auto" />
        <Skeleton className="h-16 w-2/3" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
