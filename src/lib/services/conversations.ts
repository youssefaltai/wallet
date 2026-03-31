import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and, desc, isNull, isNotNull, sql } from "drizzle-orm";
import type { UIMessage, ModelMessage } from "ai";

/** Typed shape for tool invocation parts stored in the DB parts column. */
interface ToolInvocationPart {
  type: string;
  toolCallId: string;
  state: string;
  input: unknown;
  output: unknown;
}

export async function getConversations(
  userId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        isNull(conversations.archivedAt)
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function countConversations(
  userId: string,
  archived: boolean = false
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        archived ? isNotNull(conversations.archivedAt) : isNull(conversations.archivedAt)
      )
    );
  return result.count;
}

export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<UIMessage[]> {
  // Verify ownership
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  if (!conv) return [];

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(200);

  // Convert DB messages to UIMessage format
  return msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const uiParts: UIMessage["parts"] = [];

      if (m.role === "assistant" && m.parts && Array.isArray(m.parts)) {
        // Reconstruct from ordered parts (preserves natural streaming order)
        for (const p of m.parts as Array<
          | { type: "text"; text: string }
          | { type: "tool"; toolCallId: string; name: string; args?: unknown; result?: unknown }
        >) {
          if (p.type === "text") {
            uiParts.push({ type: "text" as const, text: p.text });
          } else if (p.type === "tool") {
            uiParts.push({
              type: `tool-${p.name}`,
              toolCallId: p.toolCallId,
              state: "output-available",
              input: p.args ?? {},
              output: p.result ?? { success: true },
            } as ToolInvocationPart as UIMessage["parts"][number]);
          }
        }
      } else if (m.role === "assistant") {
        // Fallback for messages saved before parts column existed
        if (m.toolCalls && Array.isArray(m.toolCalls)) {
          const resultsMap = new Map<string, unknown>();
          if (m.toolResults && Array.isArray(m.toolResults)) {
            for (const tr of m.toolResults as { id: string; result: unknown }[]) {
              resultsMap.set(tr.id, tr.result);
            }
          }
          for (const tc of m.toolCalls as { id: string; name: string; args?: unknown }[]) {
            uiParts.push({
              type: `tool-${tc.name}`,
              toolCallId: tc.id,
              state: "output-available",
              input: tc.args ?? {},
              output: resultsMap.get(tc.id) ?? { success: true },
            } as ToolInvocationPart as UIMessage["parts"][number]);
          }
        }
        if (m.content) {
          uiParts.push({ type: "text" as const, text: m.content });
        }
      } else {
        // User message
        if (m.content) {
          uiParts.push({ type: "text" as const, text: m.content });
        }
      }

      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: uiParts,
      };
    });
}

/**
 * Build ModelMessage[] directly from DB for use with streamText().
 * This bypasses convertToModelMessages() which doesn't handle
 * reconstructed tool parts correctly. Ensures proper
 * assistant→tool→assistant message alternation for tool calls.
 */
export async function getModelMessages(
  conversationId: string,
  userId: string
): Promise<ModelMessage[]> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  if (!conv) return [];

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(200);

  const result: ModelMessage[] = [];

  for (const m of msgs) {
    if (m.role === "user") {
      result.push({ role: "user", content: m.content ?? "" });
      continue;
    }

    if (m.role === "assistant") {
      if (m.parts && Array.isArray(m.parts)) {
        // Derive from ordered parts (single source of truth)
        const parts = m.parts as Array<
          | { type: "text"; text: string }
          | { type: "tool"; toolCallId: string; name: string; args?: unknown; result?: unknown }
        >;

        const toolParts = parts.filter((p) => p.type === "tool");

        if (toolParts.length > 0) {
          // Assistant message with tool calls
          const assistantContent: Array<
            | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
            | { type: "text"; text: string }
          > = [];
          for (const p of parts) {
            if (p.type === "tool") {
              assistantContent.push({
                type: "tool-call" as const,
                toolCallId: p.toolCallId,
                toolName: p.name,
                input: p.args ?? {},
              });
            }
          }
          result.push({ role: "assistant", content: assistantContent });

          // Tool results message
          result.push({
            role: "tool",
            content: toolParts.map((p) => ({
              type: "tool-result" as const,
              toolCallId: p.toolCallId,
              toolName: p.name,
              output: {
                type: "json" as const,
                value: p.result ?? { success: true },
              },
            })),
          } as ModelMessage);

          // Final text after tools (if any)
          const textAfterTools = parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("\n\n");
          if (textAfterTools) {
            result.push({ role: "assistant", content: textAfterTools });
          }
        } else {
          // Text-only assistant message
          const allText = parts
            .filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("\n\n");
          if (allText) {
            result.push({ role: "assistant", content: allText });
          }
        }
      } else {
        // Fallback for pre-migration messages using legacy columns
        const toolCalls = (m.toolCalls as { id: string; name: string; args?: unknown }[] | null) ?? [];
        const toolResults = (m.toolResults as { id: string; name: string; result: unknown }[] | null) ?? [];

        const resultsMap = new Map<string, unknown>();
        for (const tr of toolResults) {
          resultsMap.set(tr.id, tr.result);
        }

        if (toolCalls.length > 0) {
          result.push({
            role: "assistant",
            content: toolCalls.map((tc) => ({
              type: "tool-call" as const,
              toolCallId: tc.id,
              toolName: tc.name,
              input: tc.args ?? {},
            })),
          });
          result.push({
            role: "tool",
            content: toolCalls.map((tc) => ({
              type: "tool-result" as const,
              toolCallId: tc.id,
              toolName: tc.name,
              output: {
                type: "json" as const,
                value: resultsMap.get(tc.id) ?? { success: true },
              },
            })),
          } as ModelMessage);
          if (m.content) {
            result.push({ role: "assistant", content: m.content });
          }
        } else if (m.content) {
          result.push({ role: "assistant", content: m.content });
        }
      }
    }
  }

  return result;
}

// ── Write operations ──────────────────────────────────────────────────

export async function createConversation(userId: string) {
  const [conv] = await db
    .insert(conversations)
    .values({ userId })
    .returning();
  return conv;
}

export async function verifyConversationOwnership(
  conversationId: string,
  userId: string
) {
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return !!conv;
}

export async function saveUserMessage(conversationId: string, content: string) {
  await db.insert(messages).values({
    conversationId,
    role: "user",
    content,
  });
}

export async function saveAssistantMessage(
  conversationId: string,
  parts: unknown[],
  text: string,
  tokenCount: number | null
) {
  await db.insert(messages).values({
    conversationId,
    role: "assistant",
    content: text || null,
    parts,
    tokenCount,
  });
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
) {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function touchConversation(conversationId: string) {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

// ── Settings operations ──────────────────────────────────────────────

export async function getArchivedConversations(
  userId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
      archivedAt: conversations.archivedAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        isNotNull(conversations.archivedAt)
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function archiveConversation(
  conversationId: string,
  userId: string
) {
  await db
    .update(conversations)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
    );
}

export async function unarchiveConversation(
  conversationId: string,
  userId: string
) {
  await db
    .update(conversations)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
    );
}

export async function archiveAllConversations(userId: string) {
  await db
    .update(conversations)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(conversations.userId, userId), isNull(conversations.archivedAt))
    );
}

export async function deleteConversation(
  conversationId: string,
  userId: string
) {
  await db
    .delete(conversations)
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
    );
}

export async function deleteAllConversations(userId: string) {
  await db
    .delete(conversations)
    .where(eq(conversations.userId, userId));
}
