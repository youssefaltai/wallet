"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  SearchIcon,
  XIcon,
  SlidersHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import type { AccountWithBalance } from "@/lib/services/accounts";
import type { Category } from "@/lib/services/categories";

interface TransactionFiltersProps {
  accounts: AccountWithBalance[];
  expenseCategories: Category[];
  incomeCategories: Category[];
}

export function TransactionFilters({
  accounts,
  expenseCategories,
  incomeCategories,
}: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand if any filters are active beyond defaults
    return !!(
      searchParams.get("account") ||
      searchParams.get("category") ||
      searchParams.get("type") ||
      searchParams.get("from") ||
      searchParams.get("to") ||
      searchParams.get("q")
    );
  });

  const allCategories = [...expenseCategories, ...incomeCategories];

  // Current filter values from URL
  const currentAccount = searchParams.get("account") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentSearch = searchParams.get("q") ?? "";

  const hasActiveFilters = !!(
    currentAccount ||
    currentCategory ||
    currentType ||
    currentFrom ||
    currentTo ||
    currentSearch
  );

  const activeFilterCount = [
    currentAccount,
    currentCategory,
    currentType,
    currentFrom || currentTo, // count date range as one filter
    currentSearch,
  ].filter(Boolean).length;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // When changing filters, remove the default month-based date param
      // since explicit from/to or other filters take precedence
      const str = params.toString();
      startTransition(() => {
        router.push(`/transactions${str ? `?${str}` : ""}`);
      });
    },
    [router, searchParams, startTransition]
  );

  function clearAll() {
    startTransition(() => {
      router.push("/transactions");
    });
  }

  // Filter categories based on selected type
  const filteredCategories =
    currentType === "expense"
      ? expenseCategories
      : currentType === "income"
        ? incomeCategories
        : allCategories;

  // Local search state for debouncing
  const [searchValue, setSearchValue] = useState(currentSearch);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const timeout = setTimeout(() => {
      updateParams({ q: value || null });
    }, 400);
    searchTimeoutRef.current = timeout;
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      updateParams({ q: searchValue || null });
    }
  }

  return (
    <div className="space-y-3">
      {/* Top row: search + expand toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search transactions..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-8"
          />
        </div>
        <Button
          variant={hasActiveFilters ? "secondary" : "outline"}
          size="default"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <SlidersHorizontalIcon className="size-3.5" data-icon="inline-start" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {activeFilterCount}
            </span>
          )}
          {expanded ? (
            <ChevronUpIcon className="size-3.5 ml-0.5" />
          ) : (
            <ChevronDownIcon className="size-3.5 ml-0.5" />
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <XIcon className="size-3.5" data-icon="inline-start" />
            Clear all
          </Button>
        )}
      </div>

      {/* Expandable filter row */}
      {expanded && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-3">
          {/* Account filter */}
          <div className="space-y-1.5 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Account</Label>
            <Select
              value={currentAccount}
              onValueChange={(val) =>
                updateParams({ account: val === "__all__" ? null : val })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All accounts">
                  {(value: string) => {
                    if (!value || value === "__all__") return "All accounts";
                    const acct = accounts.find((a) => a.id === value);
                    return acct?.name ?? "All accounts";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All accounts</SelectItem>
                {accounts
                  .filter((a) => a.isActive)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type filter */}
          <div className="space-y-1.5 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={currentType}
              onValueChange={(val) => {
                const updates: Record<string, string | null> = {
                  type: val === "__all__" ? null : val,
                };
                // Clear category if it doesn't match the new type
                if (val !== "__all__" && currentCategory) {
                  const cat = allCategories.find(
                    (c) => c.id === currentCategory
                  );
                  if (cat && cat.type !== val) {
                    updates.category = null;
                  }
                }
                updateParams(updates);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types">
                  {(value: string) => {
                    if (!value || value === "__all__") return "All types";
                    const labels: Record<string, string> = {
                      expense: "Expenses",
                      income: "Income",
                      transfer: "Transfers",
                    };
                    return labels[value] ?? "All types";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          {currentType !== "transfer" && (
            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select
                value={currentCategory}
                onValueChange={(val) =>
                  updateParams({ category: val === "__all__" ? null : val })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All categories">
                    {(value: string) => {
                      if (!value || value === "__all__") return "All categories";
                      const cat = allCategories.find((c) => c.id === value);
                      return cat?.name ?? "All categories";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All categories</SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date from */}
          <div className="space-y-1.5 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">From</Label>
            <DatePicker
              value={currentFrom}
              onChange={(date) =>
                updateParams({ from: date || null, date: null })
              }
              placeholder="Start date"
              className="h-8 text-sm"
            />
          </div>

          {/* Date to */}
          <div className="space-y-1.5 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">To</Label>
            <DatePicker
              value={currentTo}
              onChange={(date) =>
                updateParams({ to: date || null, date: null })
              }
              placeholder="End date"
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isPending && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
