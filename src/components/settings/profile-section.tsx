"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/utils/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Camera } from "lucide-react";
import { revalidateAllAction } from "@/app/(app)/actions";
import { CurrencySelect } from "@/components/shared/currency-select";

interface Profile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: boolean;
  currency: string;
}

export function ProfileSection() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: profile, mutate: mutateProfile } = useSWR<Profile>(
    "/api/settings/profile",
    fetcher,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      initialized.current = true;
      setName(profile.name || "");
      setEmail(profile.email || "");
      setSelectedCurrency(profile.currency || "USD");
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, currency: selectedCurrency }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to save profile",
        });
        return;
      }

      if (data.needsVerification) {
        setMessage({
          type: "success",
          text: `Verification email sent to ${data.email}. Please verify to complete the change.`,
        });
        return;
      }

      mutateProfile(
        (p) => (p ? { ...p, name, email, currency: selectedCurrency } : p),
        { revalidate: false },
      );
      // Force JWT to re-read currency from DB — passing data ensures a POST
      // (calling updateSession() with no args makes a GET, which skips the
      // trigger:"update" path in the JWT callback)
      await updateSession({});
      setMessage({ type: "success", text: "Profile updated" });
      // Invalidate every cached route so currency changes propagate app-wide
      await revalidateAllAction();
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be under 2MB" });
      return;
    }

    // Convert to base64 data URI
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUri = reader.result as string;

        // Resize to 256x256 max
        const resized = await resizeImage(dataUri, 256);

        const res = await fetch("/api/settings/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: resized }),
        });

        if (res.ok) {
          mutateProfile((p) => (p ? { ...p, image: resized } : p), {
            revalidate: false,
          });
          setMessage({ type: "success", text: "Profile picture updated" });
          router.refresh();
        } else {
          setMessage({ type: "error", text: "Failed to upload image" });
        }
      } catch {
        setMessage({ type: "error", text: "Failed to upload image" });
      }
    };
    reader.readAsDataURL(file);
  }

  function resizeImage(dataUri: string, maxSize: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUri;
    });
  }

  if (!profile) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <label
          htmlFor="avatar-upload"
          className="relative group cursor-pointer block w-fit"
        >
          <UserAvatar
            name={profile.name ?? profile.email}
            image={profile.image}
            className="size-20"
            fallbackClassName="text-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Camera className="size-5 text-white" />
          </div>
          <input
            id="avatar-upload"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>
        <div>
          <p className="font-medium">{profile.name || "No name set"}</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {email !== profile.email && (
          <p className="text-xs text-muted-foreground">
            Changing your email will require re-verification.
          </p>
        )}
      </div>

      {/* Base Currency */}
      <div className="space-y-2">
        <Label htmlFor="currency">Base Currency</Label>
        <CurrencySelect
          id="currency"
          value={selectedCurrency}
          onChange={setSelectedCurrency}
        />
        <p className="text-xs text-muted-foreground">
          Used for dashboards and reporting. Accounts keep their own currency.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {message && (
          <p
            className={`text-sm ${message.type === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
