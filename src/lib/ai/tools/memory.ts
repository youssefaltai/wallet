import { tool } from "ai";
import * as z from "zod";
import { saveMemory, updateMemory, deleteMemory, listMemories } from "@/lib/services/memories";

export function createMemoryTools(userId: string) {
  return {
    save_memory: tool({
      description:
        "Save an important fact about the user's financial situation or preferences for future recall.",
      inputSchema: z.object({
        content: z
          .string()
          .min(1)
          .max(2000)
          .describe("The fact to remember, e.g. 'User is saving for a house down payment of $60,000 by December 2026'"),
        tags: z
          .array(z.string().min(1).max(50))
          .max(10)
          .describe("Tags for categorization, e.g. ['goal', 'savings', 'house']"),
      }),
      execute: async ({ content, tags }) => {
        try {
          const memory = await saveMemory(userId, content, tags);
          return { success: true, memoryId: memory.id };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    update_memory: tool({
      description: "Update an existing memory with new information.",
      inputSchema: z.object({
        memoryId: z.string().uuid().describe("The memory ID to update"),
        content: z.string().max(2000).optional().describe("New content"),
        tags: z.array(z.string().max(50)).max(10).optional().describe("New tags"),
      }),
      execute: async ({ memoryId, content, tags }) => {
        try {
          const updated = await updateMemory(memoryId, userId, { content, tags });
          if (!updated) return { success: false, error: "Memory not found" };
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    delete_memory: tool({
      description: "Delete a memory that is no longer relevant.",
      inputSchema: z.object({
        memoryId: z.string().uuid().describe("The memory ID to delete"),
      }),
      execute: async ({ memoryId }) => {
        try {
          const deleted = await deleteMemory(memoryId, userId);
          if (!deleted) return { success: false, error: "Memory not found" };
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),

    list_memories: tool({
      description: "List all memories, optionally filtered by tag.",
      inputSchema: z.object({
        tag: z
          .string()
          .optional()
          .describe("Filter by tag, e.g. 'goal' or 'preference'"),
      }),
      execute: async ({ tag }) => {
        try {
          const results = await listMemories(userId, tag);
          return { memories: results };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
        }
      },
    }),
  };
}
