"use client";

import { CHAINS } from "@0xslots/contracts";
import { Check, ChevronDown, PlusIcon, User } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { DevAccountSwitcher } from "@/components/dev-account-switcher";
import { DevTimeWarp } from "@/components/dev-time-warp";
import { IndexerStatus } from "@/components/indexer-status";
import { TestnetFaucet } from "@/components/testnet-faucet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChain } from "@/context/chain";
import { NavLink, useNavigation } from "@/context/navigation";
import { EXTERNAL_LINKS } from "@/lib/external-links";

export function AppSidebar() {
  const pathname = usePathname();
  const { push, isPending } = useNavigation();
  const { chainId, setChain } = useChain();

  return (
    <Sidebar
      collapsible="none"
      className="hidden md:flex sticky top-0 h-svh border-r"
    >
      <SidebarHeader className="p-4 gap-4">
        <NavLink
          href="/"
          className="text-xl flex flex-row gap-1.5 items-center font-black tracking-tighter"
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

        <Button size="sm" className="w-full" onClick={() => push("/create")}>
          <PlusIcon className="size-4" />
          Create Slot
        </Button>
      </SidebarHeader>

      {/* Routes only.
       *
       * The explorer's sections used to live here too, and that was the wrong
       * home for them: they are a filter over one page's content, not a place
       * to go. Hoisting them into the chrome made a page-local choice look
       * like site navigation, and left the page with no header of its own.
       * They are back in the page, where the selection they drive is visible.
       */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/profile"}
                  onClick={() => push("/profile")}
                >
                  <User className="size-4" />
                  <span>My Slots</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3">
        {/* One row of icons rather than three full-width rows. These are
            off-app destinations, not navigation — they should read as a
            footer, and spelling out "Docs / GitHub / Telegram" gave them the
            same visual weight as the sections above. The name survives as a
            tooltip and as the accessible label. */}
        <div className="flex items-center gap-1 px-2">
          {EXTERNAL_LINKS.map(({ label, href, icon: Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Icon className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <SidebarSeparator />

        {/* Renders only on chains with a mintable currency, so it disappears
            on mainnet without needing a testnet check here. */}
        <TestnetFaucet />

        {/* Local chain only — both return null everywhere else. */}
        <DevAccountSwitcher />
        <DevTimeWarp />

        {/* Sits directly above the chain picker: both choose WHERE the app
            reads from, and both are persisted per browser. */}

        <div className="flex items-center justify-between px-2 pb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs h-7 px-2"
              >
                {CHAINS.find((c) => c.id === chainId)?.name ??
                  `Chain ${chainId}`}
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
          <IndexerStatus />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
