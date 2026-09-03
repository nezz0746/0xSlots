"use client";

import { Blockie } from "@/components/blockie";
import { useEnsAvatar, useEnsName } from "@/lib/ens";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/utils";

/**
 * An address shown as a person: ENS avatar + name where one exists, the
 * truncated address otherwise.
 *
 * Both resolutions are independent and either can miss — plenty of names have
 * no avatar record — so each falls back on its own rather than the whole thing
 * collapsing to a raw address.
 *
 * The fallback is a blockie — the same identicon the user menu and the
 * recipient page already use, so one address wears one face everywhere. It
 * replaced a gradient disc derived from the address: also deterministic, but
 * two addresses landing on neighbouring hues were indistinguishable, and a
 * blockie's 8x8 grid carries far more of the address than a hue does.
 */
export function EnsIdentity({
  address,
  size = 16,
  showName = true,
  className,
  nameClassName,
}: {
  address: string;
  size?: number;
  /** Set false for an avatar-only chip. */
  showName?: boolean;
  className?: string;
  nameClassName?: string;
}) {
  const { data: ensName } = useEnsName(address);
  const { data: avatar } = useEnsAvatar(ensName);

  const display = ensName || truncateAddress(address);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {avatar ? (
        // Plain <img>: ENS avatars resolve to arbitrary hosts (and data: URIs),
        // which next/image would need every one of allowlisted.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          width={size}
          height={size}
          className="rounded-full object-cover shrink-0"
          style={{ width: size, height: size }}
        />
      ) : (
        <Blockie
          address={address}
          className="rounded-full shrink-0"
          style={{ width: size, height: size }}
        />
      )}
      {showName && (
        <span className={cn("truncate", nameClassName)} title={address}>
          {display}
        </span>
      )}
    </span>
  );
}
