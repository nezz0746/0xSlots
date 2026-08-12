"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/utils";

/**
 * An address you can take with you.
 *
 * A truncated address is unusable on its own — it exists to be recognised, not
 * read, so the only thing to do with one is copy it. The button is always
 * present rather than hover-only: hover affordances do not exist on touch, and
 * this is the row's primary action.
 *
 * Copies the FULL address, never the truncation shown.
 */
export function CopyAddress({
  address,
  className,
  truncate = true,
  showAddress = true,
}: {
  address: string;
  className?: string;
  truncate?: boolean;
  /**
   * Render the copy button alone.
   *
   * For places that already show the address by other means — a row whose
   * address cell is a link to the thing — where repeating it would be noise but
   * the ability to take it is still wanted.
   */
  showAddress?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clearing on unmount matters here: rows unmount as the accordion collapses,
  // and a pending timer would call setState on a gone component.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async (e: React.MouseEvent) => {
    // Rows are clickable to expand; copying must not also toggle them.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable over plain http on some browsers. Failing
      // silently is better than a toast for something the user can still
      // select by hand.
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showAddress && (
        <span className="font-mono text-xs">
          {truncate ? truncateAddress(address) : address}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${address}`}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3 text-emerald-600 dark:text-emerald-500" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </span>
  );
}
