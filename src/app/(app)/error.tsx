"use client";
import { ErrorContent } from "@/components/shared/error-content";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent error={error} reset={reset} minHeight="min-h-[50vh]" />;
}
