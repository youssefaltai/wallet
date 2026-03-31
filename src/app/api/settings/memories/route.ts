import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listMemories, countMemories, deleteMemory, deleteAllMemories } from "@/lib/services/memories";

export async function GET(req: Request) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
  const offset = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    listMemories(session.user.id, undefined, pageSize, offset),
    countMemories(session.user.id),
  ]);

  return NextResponse.json({
    items: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
  } catch (error) {
    console.error("[GET /api/settings/memories]", error);
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
  const memoryId = searchParams.get("id");

  if (memoryId) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(memoryId)) {
      return NextResponse.json({ error: "Invalid memory ID" }, { status: 400 });
    }
    await deleteMemory(memoryId, session.user.id);
  } else {
    // Delete all memories
    await deleteAllMemories(session.user.id);
  }

  return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/settings/memories]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
