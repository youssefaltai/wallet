import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserProfile, updateUserProfile, checkEmailTaken } from "@/lib/services/users";
import { sendVerificationEmail } from "@/lib/services/email";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserProfile(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[GET /api/settings/profile]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { allowed } = await rateLimit(`profile:${userId}`, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { name, email, image } = body;

    if (name !== undefined && typeof name === "string" && name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
    }

    if (image !== undefined && image !== null && image !== "") {
      if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
        return NextResponse.json({ error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 400 });
      }
      if (image.length > 400_000) {
        return NextResponse.json({ error: "Image too large" }, { status: 400 });
      }
    }

    const updates: { name?: string | null; image?: string | null } = {};

    if (name !== undefined) {
      updates.name = name || null;
    }

    if (image !== undefined) {
      updates.image = image || null;
    }

    // Email change requires re-verification — wrap in transaction for atomicity
    if (email && email !== session.user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      const taken = await checkEmailTaken(email, userId);
      if (taken) {
        return NextResponse.json(
          { error: "This email is already in use" },
          { status: 409 }
        );
      }

      await updateUserProfile(userId, {
        ...updates,
        email,
        emailVerified: false,
      });

      await sendVerificationEmail(userId, email);

      return NextResponse.json({ needsVerification: true, email });
    }

    await updateUserProfile(userId, updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/settings/profile]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
