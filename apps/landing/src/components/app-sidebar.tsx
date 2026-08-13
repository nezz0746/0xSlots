"use client";

import { CHAINS } from "@0xslots/contracts";
import {
  Check,
  ChevronDown,
  FlaskConical,
  PlusIcon,
  Scale,
  User,
  Users,
} from "lucide-react";
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
  SidebarGroupLabel,
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
import {
  EXPLORER_SECTIONS,
  useExplorerSection,
} from "@/context/explorer-section";
import { NavLink, useNavigation } from "@/context/navigation";
import { EXTERNAL_LINKS } from "@/lib/external-links";

export function AppSidebar() {
  const pathname = usePathname();
  const { push, isPending } = useNavigation();
  const { chainId, setChain } = useChain();
  const { section, setSection } = useExplorerSection();

  const onExplorer = pathname === "/";

  const selectSection = (id: string) => {
    setSection(id);
    // Sections live on the explorer, so jump back there when selected from
    // elsewhere in the app.
    if (!onExplorer) push("/");
  };

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

      <SidebarContent>
        {/* Sections read as destinations here, and the selection stays visible
            while you scroll a long table — which a strip pinned above the rows
            does not do. Below md there is no sidebar, so the page renders the
            same sections as a tab strip driving this same state. */}
        <SidebarGroup>
          <SidebarGroupLabel>Explore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {EXPLORER_SECTIONS.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={onExplorer && section === id}
                    onClick={() => selectSection(id)}
                  >
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Sits with the sections because it answers the same kind of
                  question — what a slot's terms can be, alongside what a slot
                  can do. It is a ROUTE, not a section: it pushes rather than
                  setting explorer state, so `isActive` reads the path. */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/policies")}
                  onClick={() => push("/policies")}
                >
                  <Scale className="size-4" />
                  <span>Policies</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* A sandbox, not a product surface — hence the dashed styling
                  and the honest label. */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/lab")}
                  onClick={() => push("/lab")}
                >
                  <FlaskConical className="size-4" />
                  <span>Lab</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

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
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/collectives")}
                  onClick={() => push("/collectives")}
                >
                  <Users className="size-4" />
                  <span>My Collectives</span>
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
