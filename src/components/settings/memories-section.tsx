"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/utils/fetcher";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Trash2 } from "lucide-react";

interface Memory {
  id: string;
  content: string;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedMemories {
  items: Memory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

export function MemoriesSection() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [page, setPage] = useState(1);
  const { data, isLoading: loading, mutate: mutateMemories } = useSWR<PaginatedMemories>(
    `/api/settings/memories?page=${page}&pageSize=${PAGE_SIZE}`,
    fetcher
  );
  const memories = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteMemory(id: string) {
    if (!(await confirm("Delete this memory? This cannot be undone."))) return;
    setError(null);
    setDeleting(id);
    try {
      const res = await fetch(`/api/settings/memories?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete memory");
      mutateMemories();
    } catch {
      setError("Failed to delete memory");
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAll() {
    if (!(await confirm("Delete all memories? This cannot be undone."))) return;
    setError(null);
    try {
      const res = await fetch("/api/settings/memories", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete all memories");
      setPage(1);
      mutateMemories();
    } catch {
      setError("Failed to delete all memories");
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "memory" : "memories"}{" "}
          saved by your AI assistant.
        </p>
        {total > 0 && (
          <Button variant="destructive" size="sm" onClick={deleteAll}>
            Delete all
          </Button>
        )}
      </div>

      {memories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No memories yet. Your AI assistant will save things it learns about
          you during conversations.
        </p>
      ) : (
        <div className="space-y-2">
          {memories.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-3 rounded-lg border p-3 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm">{m.content}</p>
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {m.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteMemory(m.id)}
                disabled={deleting === m.id}
                aria-label="Delete memory"
                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
