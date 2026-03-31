import type { Metadata } from "next";
import { cachedAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { getUserImage } from "@/lib/services/users";

export const metadata: Metadata = { title: "Chat | Wallet" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await cachedAuth();
  if (!session?.user?.id) redirect("/login");

  const [{ id }, userImage] = await Promise.all([
    params,
    getUserImage(session.user.id),
  ]);

  return (
    <div className="h-full">
      <ChatInterface
        conversationId={id}
        userName={session.user.name}
        userImage={userImage}
      />
    </div>
  );
}
