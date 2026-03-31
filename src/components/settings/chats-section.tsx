"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "@/lib/utils/fetcher";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useChatMutations } from "@/hooks/use-chat-mutations";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format-date";

interface Chat {
  id: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedChats {
  items: Chat[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

export function ChatsSection() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading: loading, mutate: mutateChats } = useSWR<PaginatedChats>(
    `/api/settings/chats?archived=${showArchived}&page=${page}&pageSize=${PAGE_SIZE}`,
    fetcher
  );
  const chats = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const { archiveChat: archiveChatMutation, unarchiveChat: unarchiveChatMutation, deleteChat: deleteChatMutation } = useChatMutations({
    onMutate: () => setError(null),
    onError: (msg) => setError(msg),
  });

  function switchTab(archived: boolean) {
    setShowArchived(archived);
    setPage(1);
  }

  async function archiveChat(id: string) {
    const ok = await archiveChatMutation(id);
    if (ok) mutateChats();
  }

  async function unarchiveChat(id: string) {
    const ok = await unarchiveChatMutation(id);
    if (ok) mutateChats();
  }

  async function deleteChat(id: string) {
    if (!(await confirm("Delete this chat? This cannot be undone."))) return;
    const ok = await deleteChatMutation(id);
    if (ok) mutateChats();
  }

  async function archiveAll() {
    if (!(await confirm("Archive all chats?"))) return;
    setError(null);
    try {
      const res = await fetch("/api/settings/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive-all" }),
      });
      if (!res.ok) throw new Error("Failed to archive all chats");
      setPage(1);
      mutateChats();
      globalMutate("/api/conversations");
    } catch {
      setError("Failed to archive all chats");
    }
  }

  async function deleteAll() {
    if (!(await confirm("Delete ALL chats? This cannot be undone."))) return;
    setError(null);
    try {
      const res = await fetch("/api/settings/chats", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete all chats");
      setPage(1);
      mutateChats();
      globalMutate("/api/conversations");
    } catch {
      setError("Failed to delete all chats");
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      {/* Toggle and actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          <Button
            variant={!showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => switchTab(false)}
          >
            Active
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => switchTab(true)}
          >
            Archived
          </Button>
        </div>
        <div className="flex gap-2">
          {!showArchived && chats.length > 0 && (
            <Button variant="outline" size="sm" onClick={archiveAll}>
              <Archive className="size-3.5 mr-1.5" />
              Archive all
            </Button>
          )}
          {total > 0 && (
            <Button variant="destructive" size="sm" onClick={deleteAll}>
              <Trash2 className="size-3.5 mr-1.5" />
              Delete all
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : chats.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {showArchived ? "No archived chats." : "No chats yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="flex items-center gap-3 rounded-lg border p-3 group overflow-hidden"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {chat.title || "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(chat.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {showArchived ? (
                  <button
                    onClick={() => unarchiveChat(chat.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Unarchive"
                    aria-label="Unarchive"
                  >
                    <ArchiveRestore className="size-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => archiveChat(chat.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Archive"
                    aria-label="Archive"
                  >
                    <Archive className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title="Delete"
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
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
