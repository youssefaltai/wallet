"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { mutate } from "swr";
import type { UIMessage } from "ai";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "./chat-message";
import { UserAvatar } from "@/components/shared/user-avatar";

export function ChatInterface({
  conversationId,
  userName,
  userImage,
}: {
  conversationId?: string;
  userName?: string | null;
  userImage?: string | null;
}) {
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(!conversationId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // activeConvId tracks the live conversation ID. It starts as the prop value
  // and may be updated by the server after the first message in a new chat.
  const [activeConvId, setActiveConvId] = useState(conversationId);

  // Recreate the transport whenever the active conversation ID changes, so the
  // body closure always captures the right ID. This is the React-idiomatic way
  // to pass changing values into a transport without refs.
  const transport = new DefaultChatTransport({
    body: () => ({ conversationId: activeConvId }),
    fetch: async (url, init) => {
      const response = await globalThis.fetch(url, init);
      const newId = response.headers.get("X-Conversation-Id");
      if (newId && newId !== activeConvId) {
        setActiveConvId(newId);
      }
      return response;
    },
  });

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
    ...(conversationId != null ? { id: conversationId } : {}),
    transport,
    onFinish: () => {
      scrollToBottom();
      if (activeConvId && !conversationId) {
        window.history.replaceState(null, "", `/chat/${activeConvId}`);
      }
      mutate("/api/conversations");
    },
  });

  // Fetch messages client-side to avoid RSC serialization stripping tool parts
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/conversations?id=${conversationId}`)
      .then((r) => r.json())
      .then((msgs: UIMessage[]) => {
        setMessages(msgs);
        setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load conversation", err);
        setLoadError("Failed to load conversation");
        setLoaded(true);
      });
  }, [conversationId, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Check if the last assistant message has any visible content
  const lastAssistantMessage = messages.findLast(
    (m) => m.role === "assistant"
  );
  const hasVisibleContent =
    lastAssistantMessage?.parts && lastAssistantMessage.parts.length > 0;

  // Show thinking indicator only while loading and no visible content yet
  const showThinking = isLoading && !hasVisibleContent;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  useEffect(() => {
    resizeTextarea();
  }, [input]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input;
    setInput("");
    await sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {loaded && loadError && (
            <div className="text-destructive text-sm p-3 rounded-md bg-destructive/10">{loadError}</div>
          )}
          {messages.length === 0 && !loadError && (
            <div className="text-center py-20 text-muted-foreground animate-fade-up">
              <h2 className="text-xl font-semibold mb-2">Welcome to Wallet</h2>
              <p>
                Tell me about your finances and I&apos;ll help you manage them.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              userName={userName}
              userImage={userImage}
            />
          ))}
          {showThinking && (
            <div className="flex gap-3 animate-fade-in-left">
              <UserAvatar
                name="Wallet"
                fallbackClassName="bg-primary/10 text-primary"
              />
              <div className="text-muted-foreground animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          {error && (
            <div className="text-destructive text-sm p-3 rounded-md bg-destructive/10">
              Something went wrong. Please try again.
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-[200px] resize-none overflow-x-hidden overflow-y-auto break-words whitespace-pre-wrap"
            rows={1}
          />
          {isLoading ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-[44px] w-[44px]"
              onClick={() => stop()}
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="shrink-0 h-[44px] w-[44px]"
              disabled={!input.trim()}
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
