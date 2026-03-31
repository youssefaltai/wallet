import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversations,
  getArchivedConversations,
  countConversations,
  archiveConversation,
  archiveAllConversations,
  unarchiveConversation,
  deleteConversation,
  deleteAllConversations,
} from "@/lib/services/conversations";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const archived = searchParams.get("archived") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
    const offset = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      archived
        ? getArchivedConversations(session.user.id, { limit: pageSize, offset })
        : getConversations(session.user.id, { limit: pageSize, offset }),
      countConversations(session.user.id, archived),
    ]);

    return NextResponse.json({
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error("[GET /api/settings/chats]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, chatId } = body;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if ((action === "archive" || action === "unarchive") && !chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    if (chatId && !UUID_RE.test(chatId)) {
      return NextResponse.json({ error: "Invalid chat ID" }, { status: 400 });
    }

    if (action === "archive" && chatId) {
      await archiveConversation(chatId, session.user.id);
    } else if (action === "unarchive" && chatId) {
      await unarchiveConversation(chatId, session.user.id);
    } else if (action === "archive-all") {
      await archiveAllConversations(session.user.id);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/settings/chats]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("id");
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (chatId && !UUID_RE.test(chatId)) {
      return NextResponse.json({ error: "Invalid chat ID" }, { status: 400 });
    }

    if (chatId) {
      await deleteConversation(chatId, session.user.id);
    } else {
      await deleteAllConversations(session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/settings/chats]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
