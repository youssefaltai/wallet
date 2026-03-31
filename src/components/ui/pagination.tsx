"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

export interface PaginationProps {
  /** Current page number (1-based) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Called when the page changes (for client-side pagination) */
  onPageChange?: (page: number) => void;
  /** Pre-computed href for the previous page (for server-side pagination) */
  prevHref?: string;
  /** Pre-computed href for the next page (for server-side pagination) */
  nextHref?: string;
  /** Function to build href for a given page (for server-side pagination) */
  buildHref?: (page: number) => string;
}

/**
 * Reusable pagination component with prev/next buttons and page info.
 * Supports both server-side (link-based) and client-side (callback-based) modes.
 */
export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  prevHref,
  nextHref,
  buildHref,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const resolvedPrevHref = prevHref ?? (buildHref && hasPrev ? buildHref(page - 1) : undefined);
  const resolvedNextHref = nextHref ?? (buildHref && hasNext ? buildHref(page + 1) : undefined);

  const isLinkMode = resolvedPrevHref !== undefined || resolvedNextHref !== undefined || buildHref !== undefined;

  if (isLinkMode) {
    // Server-side pagination with anchor links
    return (
      <nav
        className="flex items-center justify-between gap-4 pt-4"
        aria-label="Pagination"
      >
        <p className="text-sm text-muted-foreground">
          {start}–{end} of {totalItems}
        </p>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground mr-2">
            Page {page} of {totalPages}
          </span>
          {hasPrev && resolvedPrevHref ? (
            <a href={resolvedPrevHref}>
              <Button variant="outline" size="icon-sm" aria-label="Previous page">
                <ChevronLeftIcon className="size-4" />
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              size="icon-sm"
              disabled
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
          )}
          {hasNext && resolvedNextHref ? (
            <a href={resolvedNextHref}>
              <Button variant="outline" size="icon-sm" aria-label="Next page">
                <ChevronRightIcon className="size-4" />
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              size="icon-sm"
              disabled
              aria-label="Next page"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </nav>
    );
  }

  // Client-side pagination with callbacks
  return (
    <nav
      className="flex items-center justify-between gap-4 pt-4"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted-foreground">
        {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground mr-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasPrev}
          onClick={() => onPageChange?.(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!hasNext}
          onClick={() => onPageChange?.(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
