import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cachedAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DateSelector } from "@/components/layout/date-selector";
import { DateBanner } from "@/components/layout/date-banner";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { SessionProvider } from "@/components/providers/session-provider";
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
    <SessionProvider>
    <CurrencyProvider currency={session.user.currency ?? "USD"}>
      <SidebarProvider>
        <AppSidebar
          userName={session.user.name}
          userImage={userImage}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-background">
            <header className="flex items-center justify-between border-b px-4 py-2">
              <SidebarTrigger />
              <Suspense fallback={null}>
                <DateSelector />
              </Suspense>
            </header>
            <Suspense fallback={null}>
              <DateBanner />
            </Suspense>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </main>
      </SidebarProvider>
    </CurrencyProvider>
    </SessionProvider>
  );
}
