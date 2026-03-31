import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { emailVerificationCodes, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Lazy-init Resend so the app can start without the key (dev/test)
let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY environment variable is required");
    resend = new Resend(key);
  }
  return resend;
}

function generateOTP(): string {
  return randomInt(100000, 999999).toString();
}

function hashCode(code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    return createHmac("sha256", secret).update(code).digest("hex");
  }
  return createHash("sha256").update(code).digest("hex");
}

function otpEmailHTML(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;background-color:#0a0a0a;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Wallet</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#737373;">Verify your email address</p>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;">Enter this code to continue. It expires in 10 minutes.</p>
              <div style="background-color:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
                <span style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#0a0a0a;font-family:'JetBrains Mono',monospace;">${code}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#a3a3a3;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#d4d4d4;">Wallet &mdash; AI-powered personal finance</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(
  userId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const code = generateOTP();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Atomically delete existing codes and store new hashed code
  await db.transaction(async (tx) => {
    await tx
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, userId));

    await tx.insert(emailVerificationCodes).values({
      userId,
      email,
      code: codeHash,
      expiresAt,
    });
  });

  if (!process.env.EMAIL_FROM) {
    console.warn(
      "EMAIL_FROM is not set — using dev default. Set EMAIL_FROM in production."
    );
  }
  const fromAddress = process.env.EMAIL_FROM || "Wallet <noreply@localhost>";

  const { error } = await getResend().emails.send({
    from: fromAddress,
    to: email,
    subject: `${code} is your Wallet verification code`,
    html: otpEmailHTML(code),
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function verifyEmailCode(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  // Fetch by userId only — we compare the hash in application code
  const [record] = await db
    .select()
    .from(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, userId))
    .limit(1);

  if (!record) {
    return { success: false, error: "Invalid verification code" };
  }

  if (new Date() > record.expiresAt) {
    await db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.id, record.id));
    return { success: false, error: "Verification code has expired" };
  }

  // Timing-safe comparison of hashes
  const submittedHash = hashCode(code);
  const storedHash = record.code;
  if (
    submittedHash.length !== storedHash.length ||
    !timingSafeEqual(Buffer.from(submittedHash), Buffer.from(storedHash))
  ) {
    // Track attempts — only invalidate after 3 failed tries
    const newAttempts = (record.attempts ?? 0) + 1;
    if (newAttempts >= 3) {
      await db
        .delete(emailVerificationCodes)
        .where(eq(emailVerificationCodes.id, record.id));
      return { success: false, error: "Too many failed attempts. Please request a new code." };
    }
    await db
      .update(emailVerificationCodes)
      .set({ attempts: newAttempts })
      .where(eq(emailVerificationCodes.id, record.id));
    return { success: false, error: "Invalid verification code" };
  }

  // Atomically clean up code and mark email as verified
  await db.transaction(async (tx) => {
    await tx
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, userId));

    await tx
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });

  return { success: true };
}
