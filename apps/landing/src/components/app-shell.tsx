"use client";

import { CHAINS } from "@0xslots/contracts";
import { Check, ChevronDown, Menu, User } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { IndexerStatus } from "@/components/indexer-status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { useChain } from "@/context/chain";
import { ExplorerSectionProvider } from "@/context/explorer-section";
import { useFarcaster } from "@/context/farcaster";
import { NavLink, useNavigation } from "@/context/navigation";
import { EXTERNAL_LINKS, openExternal } from "@/lib/external-links";

export function AppShell({ children }: { children: ReactNode }) {
  const { isMiniApp, user, miniappContext } = useFarcaster();
  const { chainId, setChain } = useChain();
  const { push, isPending } = useNavigation();

  const logo = (
    <NavLink
      href="/app"
      className="text-2xl flex flex-row gap-1.5 items-center font-black tracking-tighter"
    >
      <Image
        src="/logo.png"
        width={100}
        height={100}
        alt=""
        className={`w-6 aspect-square h-6 transition-transform ${isPending ? "animate-spin" : ""}`}
      />
      0xSlots
    </NavLink>
  );

  const chainSelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
          {CHAINS.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {CHAINS.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setChain(c.id)}>
            {c.name}
            {c.id === chainId && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const mobileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 px-2">
          {isMiniApp && user?.pfpUrl ? (
            <Image
              src={user.pfpUrl}
              alt=""
              width={20}
              height={20}
              className="size-5 rounded-full"
            />
          ) : (
            <Menu className="size-4" />
          )}
          {isMiniApp && user?.username && (
            <span className="text-xs font-medium">
              {user.displayName ?? user.username}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => push("/app/profile")}>
          <User className="size-4" />
          My Slots
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {EXTERNAL_LINKS.map(({ label, href, icon: Icon }) => (
          <DropdownMenuItem
            key={label}
            onClick={() => openExternal(href, isMiniApp)}
          >
            <Icon className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const safeBottom = isMiniApp
    ? (miniappContext?.client.safeAreaInsets?.bottom ?? 5)
    : 5;
  // 5px top padding + ~28px button (h-7) + bottom padding
  const bottomBarHeight = 5 + 28 + safeBottom;

  const bottomBar = (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex items-center justify-between px-4 md:hidden"
      style={{ paddingBottom: safeBottom, paddingTop: 5 }}
    >
      {chainSelector}
      <div className="flex items-center gap-2">
        <IndexerStatus />
      </div>
    </nav>
  );

  return (
    <ExplorerSectionProvider>
      <SidebarProvider
        style={
          { "--bottom-bar-h": `${bottomBarHeight}px` } as React.CSSProperties
        }
      >
        {/* Desktop navigation. Renders nothing below md — mobile keeps the
            top nav + bottom bar it already had. */}
        <AppSidebar />

        <SidebarInset className="min-h-svh flex flex-col">
          {/* Chrome only — the account menu, and the logo on small screens
              where there is no sidebar to hold it. Everything a page has to
              say about itself belongs in its own PageHeader, below this.

              Sticky rather than fixed, so it spans the content column beside
              the sidebar instead of overlapping it. */}
          <nav className="sticky top-0 z-50 bg-background flex items-center justify-between p-2 border-b">
            {/* The sidebar carries the logo on desktop. */}
            <div className="flex flex-row items-center gap-6 md:hidden">
              {logo}
            </div>

            <div className="flex items-center justify-end flex-1">
              {/* Miniapp: compact dropdown, Web: full user menu */}
              {isMiniApp ? mobileMenu : <UserMenu />}
            </div>
          </nav>

          <main
            className="flex-1 flex flex-col md:pb-0"
            style={{ paddingBottom: `var(--bottom-bar-h, 0px)` }}
          >
            {children}
          </main>

          {bottomBar}
        </SidebarInset>
      </SidebarProvider>
    </ExplorerSectionProvider>
  );
}
