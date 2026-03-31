"use client";

import { cn } from "@/lib/utils";

interface AnimateInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}

export function AnimateIn({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: AnimateInProps) {
  return (
    <Tag
      className={cn("animate-fade-up", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
