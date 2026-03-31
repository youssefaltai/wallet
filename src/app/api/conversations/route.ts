import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversationMessages,
  getConversations,
} from "@/lib/services/conversations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = await rateLimit(`conversations:${session.user.id}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    // No id param → return conversation list for sidebar
    if (!id) {
      const conversations = await getConversations(session.user.id);
      return NextResponse.json(conversations);
    }

    const messages = await getConversationMessages(id, session.user.id);
    return NextResponse.json(messages);
  } catch (error) {
    console.error("[GET /api/conversations]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
