"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useChatMutations } from "@/hooks/use-chat-mutations";
import useSWR from "swr";
import { fetcher } from "@/lib/utils/fetcher";
import { signOut } from "next-auth/react";
import {
  MessageSquarePlus,
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Target,
  Settings,
  Archive,
  Trash2,
  LogOut,
} from "lucide-react";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const navItems = [
  { title: "New Chat", href: "/chat", icon: MessageSquarePlus },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Accounts", href: "/accounts", icon: Landmark },
  { title: "Expenses", href: "/expenses", icon: ArrowUpRight },
  { title: "Income", href: "/income", icon: ArrowDownLeft },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Goals", href: "/goals", icon: Target },
];

interface ConversationItem {
  id: string;
  title: string | null;
  updatedAt: Date;
}

export function AppSidebar({
  userName,
  userImage,
}: {
  userName?: string | null;
  userImage?: string | null;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { data: conversations = [] } = useSWR<ConversationItem[]>(
    "/api/conversations",
    fetcher,
  );
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { archiveChat: archiveChatMutation, deleteChat: deleteChatMutation } = useChatMutations();

  const date = searchParams.get("date");

  function withDate(href: string) {
    return date ? `${href}?date=${date}` : href;
  }

  async function archiveChat(id: string) {
    await archiveChatMutation(id);
    if (pathname === `/chat/${id}`) router.push("/chat");
  }

  async function deleteChat(id: string) {
    if (!(await confirm("Delete this chat? This cannot be undone."))) return;
    await deleteChatMutation(id);
    if (pathname === `/chat/${id}`) router.push("/chat");
  }

  return (
    <Sidebar>
      <ConfirmDialog />
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-lg font-semibold">Wallet</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      item.href === "/chat"
                        ? pathname === "/chat"
                        : pathname.startsWith(item.href)
                    }
                    render={<Link href={withDate(item.href)} />}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {conversations.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.map((conv) => (
                  <SidebarMenuItem key={conv.id}>
                    <ContextMenu>
                      <ContextMenuTrigger className="w-full">
                        <SidebarMenuButton
                          isActive={pathname === `/chat/${conv.id}`}
                          render={<Link href={`/chat/${conv.id}`} />}
                        >
                          <span className="truncate text-sm">
                            {conv.title || "Untitled"}
                          </span>
                        </SidebarMenuButton>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => archiveChat(conv.id)}>
                          <Archive />
                          Archive Chat
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onClick={() => deleteChat(conv.id)}
                        >
                          <Trash2 />
                          Delete Chat
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton>
                    <UserAvatar
                      name={userName}
                      image={userImage}
                      className="size-5"
                      fallbackClassName="text-[10px]"
                    />
                    <span>{userName || "Account"}</span>
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="size-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="size-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  );
}
