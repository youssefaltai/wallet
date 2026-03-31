import { openai } from "@ai-sdk/openai";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { createFinancialReadTools } from "@/lib/ai/tools/financial-read";
import { createFinancialWriteTools } from "@/lib/ai/tools/financial-write";
import { createMemoryTools } from "@/lib/ai/tools/memory";
import { createSettingsTools } from "@/lib/ai/tools/settings";
import {
  getModelMessages,
  createConversation,
  verifyConversationOwnership,
  saveUserMessage,
  saveAssistantMessage,
  updateConversationTitle,
  touchConversation,
} from "@/lib/services/conversations";
import { getMemoriesForContext } from "@/lib/services/memories";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const currency = session.user.currency ?? "USD";

  // Rate limit: 20 requests per minute per user
  const { allowed } = await rateLimit(`chat:${userId}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const { messages: incomingMessages, conversationId } = body;

  // Input validation
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }
  if (conversationId !== undefined && typeof conversationId !== "string") {
    return NextResponse.json({ error: "conversationId must be a string" }, { status: 400 });
  }

  if (JSON.stringify(incomingMessages).length > 100_000) {
    return NextResponse.json({ error: "Message payload too large" }, { status: 400 });
  }

  // Persist conversation if needed
  let convId = conversationId as string | undefined;
  if (!convId) {
    const conv = await createConversation(userId);
    convId = conv.id;
  } else {
    // Verify ownership of existing conversation
    const isOwner = await verifyConversationOwnership(convId, userId);
    if (!isOwner) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  }

  // Save the user's latest message
  const lastMessage = incomingMessages[incomingMessages.length - 1];
  if (lastMessage?.role === "user") {
    // AI SDK v6 sends parts array instead of content string
    const userText =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : Array.isArray(lastMessage.parts)
          ? lastMessage.parts
              .filter((p: { type: string }) => p.type === "text")
              .map((p: { text: string }) => p.text)
              .join("")
          : JSON.stringify(lastMessage.content ?? lastMessage.parts ?? "");
    await saveUserMessage(convId, userText);
  }

  const tools = {
    ...createFinancialReadTools(userId, currency),
    ...createFinancialWriteTools(userId, currency),
    ...createMemoryTools(userId),
    ...createSettingsTools(userId),
  };

  // Fetch all memories for injection into system context
  const memoryRows = await getMemoriesForContext(userId);

  let memoriesContext = "";
  if (memoryRows.length > 0) {
    const escape = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const formatted = memoryRows
      .map((m) => {
        const escapedTags = m.tags?.map(escape);
        return `<memory id="${m.id}">${escape(m.content)}${escapedTags?.length ? ` (tags: ${escapedTags.join(", ")})` : ""}</memory>`;
      })
      .join("\n");
    memoriesContext = `## User memories\n${formatted}`;
  }

  // Enforce a character budget on memories context — truncate at element boundaries
  const MEMORY_CHAR_BUDGET = 20_000;
  if (memoriesContext.length > MEMORY_CHAR_BUDGET) {
    const header = "## User memories\n";
    let truncated = header;
    for (const m of memoryRows) {
      const escape = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const escapedTags = m.tags?.map(escape);
      const line = `<memory id="${m.id}">${escape(m.content)}${escapedTags?.length ? ` (tags: ${escapedTags.join(", ")})` : ""}</memory>\n`;
      if (truncated.length + line.length > MEMORY_CHAR_BUDGET) break;
      truncated += line;
    }
    memoriesContext = truncated;
  }

  // convId is guaranteed non-null after the create-or-verify block above
  const finalConvId: string = convId;

  // For existing conversations, build model messages from DB (has proper tool
  // call/result data). For new conversations, convert the client-sent messages.
  // Only allow user-role messages from the client to prevent prompt injection
  const safeMessages = incomingMessages.filter(
    (m: { role?: unknown }) => m.role === "user"
  );
  const modelMessages = conversationId
    ? await getModelMessages(finalConvId, userId)
    : await convertToModelMessages(safeMessages);


  const result = streamText({
    model: openai(process.env.AI_MODEL || "gpt-4.1-mini"),
    maxOutputTokens: 8192,
    system: [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT,
        providerOptions: {
          anthropic: {
            cacheControl: { type: "ephemeral" as const },
          },
        },
      },
      {
        role: "system" as const,
        content: `Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      },
      ...(memoriesContext
        ? [
            {
              role: "system" as const,
              content: memoriesContext,
              providerOptions: {
                anthropic: {
                  cacheControl: { type: "ephemeral" as const },
                },
              },
            },
          ]
        : []),
    ],
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
    onFinish: async ({ text, usage, steps }) => {
      try {
      // Build parts in natural order: iterate steps to preserve
      // the exact sequence of text and tool calls as the model produced them.
      const orderedParts: Array<
        | { type: "text"; text: string }
        | { type: "tool"; toolCallId: string; name: string; args: unknown; result: unknown }
      > = [];
      const allResults = steps
        ?.flatMap((step) => step.toolResults ?? []);
      const resultsMap = new Map<string, unknown>();
      for (const tr of allResults ?? []) {
        resultsMap.set(tr.toolCallId, tr.output);
      }
      for (const step of steps ?? []) {
        if (step.text) {
          orderedParts.push({ type: "text", text: step.text });
        }
        for (const tc of step.toolCalls ?? []) {
          orderedParts.push({
            type: "tool",
            toolCallId: tc.toolCallId,
            name: tc.toolName,
            args: tc.input,
            result: resultsMap.get(tc.toolCallId),
          });
        }
      }

      if (orderedParts.length > 0) {
        await saveAssistantMessage(finalConvId, orderedParts, text, usage?.totalTokens ?? null);
      }

      // Title from first user message
      if (incomingMessages.length <= 1 && text) {
        const titleSource =
          typeof lastMessage?.content === "string"
            ? lastMessage.content
            : Array.isArray(lastMessage?.parts)
              ? lastMessage.parts
                  .filter((p: { type: string }) => p.type === "text")
                  .map((p: { text: string }) => p.text)
                  .join("")
              : "";
        const title = titleSource.slice(0, 100) || "New conversation";
        await updateConversationTitle(finalConvId, title);
      } else {
        await touchConversation(finalConvId);
      }
      } catch (err) {
        console.error("[chat:onFinish]", err);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "X-Conversation-Id": finalConvId,
    },
  });
  } catch (error) {
    console.error("[POST /api/chat]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
