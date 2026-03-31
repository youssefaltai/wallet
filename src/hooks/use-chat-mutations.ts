import { mutate as globalMutate } from "swr";

export function useChatMutations(options?: {
  onMutate?: () => void;
  onError?: (error: string) => void;
}) {
  async function archiveChat(id: string) {
    options?.onMutate?.();
    try {
      const res = await fetch("/api/settings/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", chatId: id }),
      });
      if (!res.ok) throw new Error("Failed to archive chat");
      globalMutate("/api/conversations");
      return true;
    } catch (error) {
      const message = "Failed to archive chat";
      options?.onError?.(message);
      console.error(message, error);
      return false;
    }
  }

  async function unarchiveChat(id: string) {
    options?.onMutate?.();
    try {
      const res = await fetch("/api/settings/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unarchive", chatId: id }),
      });
      if (!res.ok) throw new Error("Failed to unarchive chat");
      globalMutate("/api/conversations");
      return true;
    } catch (error) {
      const message = "Failed to unarchive chat";
      options?.onError?.(message);
      console.error(message, error);
      return false;
    }
  }

  async function deleteChat(id: string) {
    options?.onMutate?.();
    try {
      const res = await fetch(`/api/settings/chats?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chat");
      globalMutate("/api/conversations");
      return true;
    } catch (error) {
      const message = "Failed to delete chat";
      options?.onError?.(message);
      console.error(message, error);
      return false;
    }
  }

  return { archiveChat, unarchiveChat, deleteChat };
}
