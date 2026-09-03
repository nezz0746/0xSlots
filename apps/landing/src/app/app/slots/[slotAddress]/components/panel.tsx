"use client";

import { Check, Copy, type LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/utils";

/** A titled block. The page is a stack of these and nothing else. */
export function Panel({
  icon: Icon,
  title,
  subtitle,
  tint,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  /** Tailwind tile classes, shared with the create form's sections. */
  tint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className={cn(
            "flex size-5 items-center justify-center",
            tint ?? "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-3" />
        </span>
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {subtitle}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
  hint,
  emphasis,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-right">
        <span
          className={cn(
            "tabular-nums",
            emphasis ? "text-sm font-semibold" : "text-xs",
          )}
        >
          {value}
        </span>
        {hint ? (
          <span className="block text-[10px] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** An address with a copy button. Never truncated below the copyable value. */
export function AddressText({
  address,
  label,
  className,
}: {
  address: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={address}
      onClick={() => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={cn(
        "inline-flex items-center gap-1 text-xs hover:text-foreground text-muted-foreground",
        className,
      )}
    >
      {label ?? truncateAddress(address)}
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3 opacity-50" />
      )}
    </button>
  );
}

/**
 * One labelled input with its own submit button.
 *
 * Every action on this page is "one number, one button", and giving each its
 * own form is what keeps a half-typed price out of the deposit field beside it.
 */
export function ActionRow({
  label,
  hint,
  placeholder,
  suffix,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled,
  busy,
  children,
}: {
  label: string;
  hint?: ReactNode;
  placeholder?: string;
  suffix?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-0">
        <Input
          value={value}
          inputMode="decimal"
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-none"
        />
        {suffix ? (
          <span className="flex items-center border border-l-0 px-2 text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none border-l-0"
          disabled={disabled || busy}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
      {children}
      {hint ? (
        <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** A labelled input with no button of its own — part of a larger submission. */
export function NumberField({
  label,
  hint,
  placeholder,
  suffix,
  value,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  placeholder?: string;
  suffix?: ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex gap-0">
        <Input
          value={value}
          inputMode="decimal"
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-none"
        />
        {suffix ? (
          <span className="flex items-center border border-l-0 px-2 text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
