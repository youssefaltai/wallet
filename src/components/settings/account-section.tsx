"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountSection() {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText !== "DELETE") return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/account", { method: "DELETE" });

      if (res.ok) {
        await signOut({ callbackUrl: "/login" });
      } else {
        setError("Failed to delete account");
        setDeleting(false);
      }
    } catch {
      setError("Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-destructive/30 p-4 space-y-4">
        <div>
          <h3 className="text-base font-medium text-destructive">
            Delete account
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold">DELETE</span> to
            confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="max-w-xs"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          variant="destructive"
          disabled={confirmText !== "DELETE" || deleting}
          onClick={handleDelete}
        >
          {deleting ? "Deleting..." : "Delete my account"}
        </Button>
      </div>
    </div>
  );
}
