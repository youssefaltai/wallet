import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Welcome placeholder */}
          <div className="text-center py-20">
            <Skeleton className="h-7 w-48 mx-auto mb-2" />
            <Skeleton className="h-5 w-80 mx-auto" />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Skeleton className="h-[44px] w-full rounded-md" />
          <Skeleton className="h-[44px] w-[44px] shrink-0 rounded-md" />
        </div>
      </div>
    </div>
  );
}
