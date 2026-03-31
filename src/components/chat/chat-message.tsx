"use client";

import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toolCardRegistry } from "./tool-cards";
import { friendlyNames, completedNames, failedNames } from "@/lib/constants/tool-labels";
import { UserAvatar } from "@/components/shared/user-avatar";

interface ChatMessageProps {
  message: UIMessage;
  userName?: string | null;
  userImage?: string | null;
}

export function ChatMessage({
  message,
  userName,
  userImage,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser
          ? "flex-row-reverse animate-fade-in-right"
          : "animate-fade-in-left",
      )}
    >
      {isUser ? (
        <UserAvatar
          name={userName}
          image={userImage}
          className="flex-shrink-0"
        />
      ) : (
        <UserAvatar
          name="Wallet"
          className="flex-shrink-0"
          fallbackClassName="bg-primary/10 text-primary"
        />
      )}
      <div
        className={cn("flex-1 space-y-2", isUser && "flex flex-col items-end")}
      >
        {message.parts.map((part, i) => (
          <MessagePart key={i} part={part} isUser={isUser} />
        ))}
      </div>
    </div>
  );
}

function MessagePart({
  part,
  isUser,
}: {
  part: UIMessage["parts"][number];
  isUser: boolean;
}) {
  if (part.type === "text") {
    if (isUser) {
      return (
        <div className="bg-muted px-4 py-2 rounded-lg text-sm">
          {part.text.split("\n").map((line, j) => (
            <p key={j} className={j > 0 ? "mt-2" : ""}>
              {line}
            </p>
          ))}
        </div>
      );
    }

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }

  // Tool invocation parts have type like "tool-get_accounts", "tool-record_expense", etc.
  if (part.type.startsWith("tool-")) {
    const toolPart = part as {
      type: string;
      state: string;
      toolCallId: string;
      output?: unknown;
    };
    const toolName = part.type.replace("tool-", "");

    const isComplete =
      toolPart.state === "result" || toolPart.state === "output-available";
    const CardComponent =
      isComplete && toolPart.output !== undefined
        ? toolCardRegistry[toolName]
        : undefined;

    return (
      <>
        <ToolInvocationDisplay
          toolName={toolName}
          state={toolPart.state}
          output={toolPart.output}
        />
        {CardComponent && (
          <CardComponent output={toolPart.output} toolName={toolName} />
        )}
      </>
    );
  }

  return null;
}

function ToolInvocationDisplay({
  toolName,
  state,
  output,
}: {
  toolName: string;
  state: string;
  output?: unknown;
}) {
  const displayName = friendlyNames[toolName] ?? toolName;

  if (
    state === "call" ||
    state === "partial-call" ||
    state === "input-streaming" ||
    state === "input-available"
  ) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2 py-1">
        <span className="animate-pulse">●</span>
        {displayName}...
      </div>
    );
  }

  const success =
    output == null || (output as { success?: boolean }).success !== false;
  const completedName = completedNames[toolName] ?? displayName;

  if (!success) {
    const failedName = failedNames[toolName] ?? `Failed to complete ${displayName.toLowerCase()}`;
    return (
      <div className="text-xs text-negative flex items-center gap-2 py-1">
        <span>✗</span>
        {failedName}
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2 py-1">
      <span className="text-positive">✓</span>
      {completedName}
    </div>
  );
}
