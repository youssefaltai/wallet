"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  // Fetch the masked email from the server on mount (no email in URL)
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!userId || hasFetched.current) return;
    hasFetched.current = true;
    fetch("/api/auth/user-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.maskedEmail) setEmail(data.maskedEmail);
      })
      .catch(() => {
        // Silently fail — the page still works without the display email
      });
  }, [userId]);

  function handleDigitChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;

    const next = [...digits];
    next[index] = value;
    setDigits(next);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (value && index === 5 && next.every((d) => d)) {
      handleVerify(next.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const next = pasted.split("");
      setDigits(next);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  }

  async function handleVerify(code?: string) {
    const otp = code || digits.join("");
    if (otp.length !== 6) return;

    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code: otp }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Verification failed");
      setLoading(false);
      return;
    }

    setLoading(false);
    setVerified(true);

    // Try to auto-sign-in with credentials stashed during signup
    let creds: { email: string; password: string } | null = null;
    try {
      const raw = sessionStorage.getItem("__signup_creds");
      if (raw) {
        creds = JSON.parse(raw);
        sessionStorage.removeItem("__signup_creds");
      }
    } catch {
      // sessionStorage unavailable or parse error — fall through
    }

    if (creds) {
      const result = await signIn("credentials", {
        email: creds.email,
        password: creds.password,
        redirect: false,
      });

      if (result && !result.error) {
        redirectTimeoutRef.current = setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1500);
        return;
      }
    }

    // Fallback: redirect to login if auto-sign-in isn't possible
    redirectTimeoutRef.current = setTimeout(() => {
      router.push("/login?verified=1");
    }, 2000);
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError(null);

    const res = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    setResending(false);

    if (!res.ok) {
      setError("Failed to resend code");
    } else {
      setResent(true);
    }
  }

  if (verified) {
    return (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle className="text-2xl">Email verified</CardTitle>
            <CardDescription>
              Your email has been verified successfully. Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
    );
  }

  return (
      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle className="text-2xl">Verify your email</CardTitle>
          <CardDescription>
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {resent && (
            <p className="text-sm text-muted-foreground">
              A new code has been sent to your email.
            </p>
          )}
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg font-mono font-semibold"
                autoFocus={i === 0}
              />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="button"
            className="w-full"
            disabled={loading || digits.some((d) => !d)}
            onClick={() => handleVerify()}
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {resending ? "Sending..." : "Didn't get the code? Resend"}
          </button>
        </CardFooter>
      </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center p-8 text-muted-foreground">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
