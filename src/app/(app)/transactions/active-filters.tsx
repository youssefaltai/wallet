"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

export type ActiveFilter = {
  /** The search param key(s) to remove when clearing this filter */
  paramKeys: string[];
  /** Human-readable label, e.g. "Account: Checking" */
  label: string;
};

export function ActiveFilters({ filters }: { filters: ActiveFilter[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (filters.length === 0) return null;

  function removeFilter(paramKeys: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of paramKeys) {
      params.delete(key);
    }
    router.push(`/transactions?${params.toString()}`);
  }

  function clearAll() {
    router.push("/transactions");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filters:</span>
      {filters.map((filter) => (
        <Badge
          key={filter.paramKeys.join(",")}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {filter.label}
          <button
            type="button"
            onClick={() => removeFilter(filter.paramKeys)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove filter: ${filter.label}`}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      {filters.length > 1 && (
        <Button variant="ghost" size="xs" onClick={clearAll}>
          Clear all
        </Button>
      )}
    </div>
  );
}
