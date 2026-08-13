"use client";

import { CHAINS } from "@0xslots/contracts";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Check, Copy, LogOut, Network, User, Wallet } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount, useDisconnect } from "wagmi";

import { Blockie } from "@/components/blockie";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChain } from "@/context/chain";
import { useFarcaster } from "@/context/farcaster";
import { useNavigation } from "@/context/navigation";
import { useEnsAvatar, useEnsName } from "@/lib/ens";
import { EXTERNAL_LINKS, openExternal } from "@/lib/external-links";
import { truncateAddress } from "@/utils";

export function UserMenu() {
  const { push } = useNavigation();
  const { isMiniApp } = useFarcaster();
  const { chainId, setChain } = useChain();
  const { connector } = useAccount();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState(false);

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        return connected ? (
          <ConnectedMenu
            account={account}
            chainId={chainId}
            setChain={setChain}
            connector={connector}
            disconnect={disconnect}
            push={push}
            isMiniApp={isMiniApp}
            copied={copied}
            copyAddress={copyAddress}
          />
        ) : (
          <DisconnectedMenu
            mounted={!!mounted}
            openConnectModal={openConnectModal}
            chainId={chainId}
            setChain={setChain}
            isMiniApp={isMiniApp}
          />
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

function DisconnectedMenu({
  mounted,
  openConnectModal,
  chainId,
  setChain,
  isMiniApp,
}: {
  mounted: boolean;
  openConnectModal: () => void;
  chainId: number;
  setChain: (id: number) => void;
  isMiniApp: boolean;
}) {
  return (
    <div
      {...(!mounted && {
        "aria-hidden": true,
        style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
      })}
    >
      {/* Desktop: network and links live in the sidebar, so there's nothing
          left to put in a menu — connect directly. */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2 hidden md:flex"
        onClick={openConnectModal}
      >
        <Wallet className="size-4" />
        Connect Wallet
      </Button>

      {/* Mobile web has no sidebar — keep the full menu. */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Wallet className="size-4" />
              No Wallet
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={openConnectModal}>
                <Wallet className="size-4" />
                Connect Wallet
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Network className="size-4" />
                  Network
                  <span className="ml-auto text-xs text-muted-foreground">
                    {CHAINS.find((c) => c.id === chainId)?.name ??
                      `Chain ${chainId}`}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {CHAINS.map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => setChain(c.id)}>
                      {c.name}
                      {c.id === chainId && (
                        <Check className="ml-auto size-3.5" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {EXTERNAL_LINKS.map(({ label, href, icon: Icon }) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() => openExternal(href, isMiniApp)}
                >
                  <Icon className="size-4" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ConnectedMenu({
  account,
  chainId,
  setChain,
  connector,
  disconnect,
  push,
  isMiniApp,
  copied,
  copyAddress,
}: {
  account: { address: string; displayBalance?: string };
  chainId: number;
  setChain: (id: number) => void;
  connector: ReturnType<typeof useAccount>["connector"];
  disconnect: () => void;
  push: (path: string) => void;
  isMiniApp: boolean;
  copied: boolean;
  copyAddress: (address: string) => void;
}) {
  const { data: ensName } = useEnsName(account.address);
  const { data: ensAvatar } = useEnsAvatar(ensName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {ensAvatar ? (
            <Image
              src={ensAvatar}
              alt=""
              width={20}
              height={20}
              className="size-5 rounded-full"
            />
          ) : (
            <Blockie
              address={account.address}
              className="size-5 rounded-full"
            />
          )}
          {ensName ?? truncateAddress(account.address)}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <button
            type="button"
            className="flex items-center gap-2 w-full text-left cursor-pointer"
            onClick={() => copyAddress(account.address)}
          >
            {ensAvatar ? (
              <Image
                src={ensAvatar}
                alt=""
                width={32}
                height={32}
                className="size-8 rounded-full shrink-0"
              />
            ) : (
              <Blockie
                address={account.address}
                className="size-8 rounded-full shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              {ensName && (
                <p className="text-sm font-medium truncate">{ensName}</p>
              )}
              <p className="text-xs text-muted-foreground font-mono">
                {truncateAddress(account.address)}
              </p>
              {connector && (
                <div className="flex items-center gap-1 mt-0.5">
                  {connector.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={connector.icon}
                      alt=""
                      className="size-3 rounded-sm"
                    />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {connector.name}
                  </span>
                </div>
              )}
            </div>
            {copied ? (
              <Check className="size-3.5 text-green-500 shrink-0" />
            ) : (
              <Copy className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Desktop reaches all of this from the sidebar. Mobile web has no
            sidebar, so it keeps the full menu. */}
        <div className="md:hidden">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => push("/app/profile")}>
              <User className="size-4" />
              My Slots
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Network className="size-4" />
                Network
                <span className="ml-auto text-xs text-muted-foreground">
                  {CHAINS.find((c) => c.id === chainId)?.name ??
                    `Chain ${chainId}`}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {CHAINS.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => setChain(c.id)}>
                    {c.name}
                    {c.id === chainId && <Check className="ml-auto size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {EXTERNAL_LINKS.map(({ label, href, icon: Icon }) => (
              <DropdownMenuItem
                key={label}
                onClick={() => openExternal(href, isMiniApp)}
              >
                <Icon className="size-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
        </div>

        <DropdownMenuItem variant="destructive" onClick={() => disconnect()}>
          <LogOut className="size-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
