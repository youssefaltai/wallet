import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface UserAvatarProps {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  name,
  image,
  size = "default",
  className,
  fallbackClassName,
}: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {image ? (
        <AvatarImage src={image} alt={name ?? "Avatar"} />
      ) : null}
      <AvatarFallback className={cn(fallbackClassName)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
