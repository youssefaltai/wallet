import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { getUserImage } from "@/lib/services/users";

export const metadata: Metadata = { title: "Chat | Wallet" };

export default async function ChatPage() {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const userImage = await getUserImage(session.user.id);

  return (
    <div className="h-full">
      <ChatInterface userName={session.user.name} userImage={userImage} />
    </div>
  );
}
