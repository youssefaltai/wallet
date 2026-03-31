"use client";

import { Button } from "@/components/ui/button";

export function ErrorContent({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
  minHeight = "min-h-screen",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  minHeight?: string;
}) {
  return (
    <div className={`${minHeight} flex items-center justify-center p-4`}>
      <div className="text-center space-y-4 animate-fade-up">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset} size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
