import { NextResponse } from "next/server";
import { getUserEmailById } from "@/lib/services/users";
import { rateLimit } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/utils/email";

/**
 * Lightweight endpoint that returns a masked email for a given userId.
 * Used by the verify-email page so the raw email never appears in the URL.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { allowed } = await rateLimit(`user-email:${userId}`, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const user = await getUserEmailById(userId);

    if (!user) {
      // Don't reveal whether a userId exists
      return NextResponse.json({ maskedEmail: "" });
    }

    return NextResponse.json({ maskedEmail: maskEmail(user.email) });
  } catch (error) {
    console.error("[POST /api/auth/user-email]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
