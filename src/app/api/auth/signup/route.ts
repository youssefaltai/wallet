import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getUserByEmail, createUser } from "@/lib/services/users";
import { sendVerificationEmail } from "@/lib/services/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const { email: rawEmail, password, name } = await req.json();

    if (!rawEmail || !password || (name && (typeof name !== "string" || name.length > 100))) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: "Password must be at most 128 characters" },
        { status: 400 }
      );
    }

    const { allowed } = await rateLimit(`signup:${email}`, 5);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const existing = await getUserByEmail(email);

    if (existing) {
      if (!existing.emailVerified) {
        await sendVerificationEmail(existing.id, email);
        return NextResponse.json(
          { id: existing.id, needsVerification: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await createUser({ email, name: name || null, passwordHash });

    await sendVerificationEmail(user.id, email);

    return NextResponse.json(
      { id: user.id, needsVerification: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/signup]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
