"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");
    const nameValue = formData.get("name");

    if (!emailValue || !passwordValue || !nameValue) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    const email = emailValue.toString();
    const password = passwordValue.toString();
    const name = nameValue.toString();

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();

    if (!res.ok && !data.needsVerification) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    setLoading(false);

    // Stash credentials so the verify-email page can auto-sign-in after
    // successful verification (avoids an extra login step).
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("__signup_creds", JSON.stringify({ email, password }));
    }

    // Redirect to email verification — only userId in URL (not sensitive),
    // the verify-email page fetches a masked email from the server.
    if (data.needsVerification) {
      router.push(`/verify-email?userId=${encodeURIComponent(data.id)}`);
      return;
    }
  }

  return (
      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create your Wallet account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-6">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
  );
}
