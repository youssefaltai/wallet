import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/services/email";
import { getUserEmailById } from "@/lib/services/users";
import { rateLimit } from "@/lib/rate-limit";
import { maskEmail } from "@/lib/utils/email";

export async function POST(req: Request) {
  try {
  const { userId } = await req.json();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const { allowed } = await rateLimit(`send-verification:${userId}`, 3);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const user = await getUserEmailById(userId);

  if (!user) {
    return NextResponse.json({ success: true, maskedEmail: "" });
  }

  const result = await sendVerificationEmail(userId, user.email);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, maskedEmail: maskEmail(user.email) });
  } catch (error) {
    console.error("[POST /api/auth/send-verification]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
