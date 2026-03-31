import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteUser } from "@/lib/services/users";
import { rateLimit } from "@/lib/rate-limit";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { allowed } = await rateLimit(`delete-account:${userId}`, 3, 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    console.log("[AUDIT] User deleted account", { userId });

    await deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/settings/account]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
