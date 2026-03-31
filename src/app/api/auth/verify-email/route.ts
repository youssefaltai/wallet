import { NextResponse } from "next/server";
import { verifyEmailCode } from "@/lib/services/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
  const { userId, code } = await req.json();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json(
      { error: "userId and code are required" },
      { status: 400 }
    );
  }

  const { allowed } = await rateLimit(`verify-email:${userId}`, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const result = await verifyEmailCode(userId, code);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/auth/verify-email]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
