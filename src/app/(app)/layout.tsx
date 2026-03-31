import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cachedAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DateSelector } from "@/components/layout/date-selector";
import { DateBanner } from "@/components/layout/date-banner";
import { getUserImage } from "@/lib/services/users";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await cachedAuth();

  if (!session?.user) {
    redirect("/login");
  }

  const userImage = await getUserImage(session.user.id);

  return (
    <SidebarProvider>
      <AppSidebar
        userName={session.user.name}
        userImage={userImage}
      />
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <SidebarTrigger />
          <Suspense fallback={null}>
            <DateSelector />
          </Suspense>
        </header>
        <Suspense fallback={null}>
          <DateBanner />
        </Suspense>
        <div className="flex-1 min-h-0">{children}</div>
      </main>
    </SidebarProvider>
  );
}
