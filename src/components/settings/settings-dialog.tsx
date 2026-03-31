"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProfileSection } from "@/components/settings/profile-section";
import { MemoriesSection } from "@/components/settings/memories-section";
import { ChatsSection } from "@/components/settings/chats-section";
import { AccountSection } from "@/components/settings/account-section";
import { cn } from "@/lib/utils";
import { User, Brain, MessageSquare, Shield } from "lucide-react";

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "memories", label: "Memories", icon: Brain },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "account", label: "Account", icon: Shield },
] as const;

type SectionId = (typeof sections)[number]["id"];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [active, setActive] = useState<SectionId>("profile");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl p-0 gap-0 overflow-hidden max-h-[85vh]"
        showCloseButton
      >
        <div className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account settings and preferences.</DialogDescription>
        </div>
        <div className="flex h-[70vh]">
          {/* Internal sidebar */}
          <nav className="w-52 shrink-0 border-r bg-muted/30 p-3 flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground px-3 py-2 mb-1">
              Settings
            </h2>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left w-full",
                  active === s.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <s.icon className="size-4 shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content area */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            <div key={active} className="animate-fade-up">
              <h2 className="text-lg font-semibold mb-6">
                {sections.find((s) => s.id === active)?.label}
              </h2>
              {active === "profile" && <ProfileSection />}
              {active === "memories" && <MemoriesSection />}
              {active === "chats" && <ChatsSection />}
              {active === "account" && <AccountSection />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
