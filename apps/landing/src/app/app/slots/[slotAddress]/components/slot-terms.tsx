"use client";

import {
  type SlotState,
  unpackHookPermissions,
  ZERO_HOOK_DATA,
} from "@0xslots/sdk/slots";
import { useQuery } from "@tanstack/react-query";
import { Settings2, UserCog } from "lucide-react";
import { useState } from "react";
import { type Address, type Hex, isAddress, isHex, zeroAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { formatBps } from "@/utils";
import { findKnownHook, knownHooks } from "@0xslots/contracts/slots";
import { HookConfig } from "@/app/app/create/components/hook-config";
import { HookPermissionRow } from "@/components/hook-permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChain } from "@/context/chain";
import { useHookCheck } from "@/hooks/use-hook-check";
import { useHookSchema } from "@/hooks/use-hook-schema";
import { describePermissions } from "@/lib/hook-permissions";
import { NumberField, Panel } from "./panel";
import { QueuedTermsControls } from "./pending-updates";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * The manager's controls: every term queues and lands at the next occupancy
 * transition. The hook is offered only when the slot did not lock it.
 */
export function ManageTermsPanel({
  slot,
  state,
  actions,
}: {
  slot: Address;
  state: SlotState;
  actions: Actions;
}) {
  const [tax, setTax] = useState("");
  const [recipient, setRecipient] = useState("");
  const [runway, setRunway] = useState("");
  const [hook, setHook] = useState("");
  const [hookData, setHookData] = useState("");
  const [hookConfigOk, setHookConfigOk] = useState(true);
  const [changeTax, setChangeTax] = useState(false);
  const [changeRecipient, setChangeRecipient] = useState(false);
  const [changeRunway, setChangeRunway] = useState(false);
  const [changeHook, setChangeHook] = useState(false);

  const taxRateBps = Math.round(Number(tax.replace(",", ".")) * 100 || 0);
  const taxValid = !changeTax || (taxRateBps > 0 && taxRateBps <= 10_000);

  const recipientTrimmed = recipient.trim();
  const recipientValid =
    !changeRecipient ||
    (isAddress(recipientTrimmed) && recipientTrimmed !== zeroAddress);

  const runwaySeconds = Math.round(Number(runway) * 3600);
  const runwayValid =
    !changeRunway ||
    (Number.isFinite(runwaySeconds) &&
      runwaySeconds >= 0 &&
      runwaySeconds <= 0xffffffff);

  // A blank hook means DETACH, which is a real intention.
  const hookTrimmed = hook.trim();
  const hookAddress = (
    hookTrimmed === "" ? zeroAddress : hookTrimmed
  ) as Address;
  const data = (hookData.trim() || ZERO_HOOK_DATA) as Hex;
  const hookValid =
    !changeHook ||
    hookAddress === zeroAddress ||
    (isAddress(hookAddress) && isHex(data) && data.length === 66 && hookConfigOk);

  const ready =
    (changeTax || changeRecipient || changeRunway || changeHook) &&
    taxValid &&
    recipientValid &&
    runwayValid &&
    hookValid;

  return (
    <Panel
      icon={Settings2}
      title="Manage terms"
      tint="bg-rose-500/10 text-rose-600 dark:text-rose-400"
      subtitle={
        <span className="text-[10px] text-muted-foreground">manager only</span>
      }
    >
      {/* Before the form, because proposing again overwrites the named terms:
          a manager has to see what they are about to replace. */}
      <QueuedTermsControls slot={slot} state={state} actions={actions} />

      <HookOfferRow slot={slot} state={state} actions={actions} />

      {state.mutableTax ? (
        <Toggle label="Change the tax rate" on={changeTax} set={setChangeTax}>
          <NumberField
            label="New tax"
            suffix="% / 30 days"
            placeholder={String(Number(state.taxRateBps) / 100)}
            value={tax}
            onChange={setTax}
            hint={
              taxValid
                ? undefined
                : "Must be above 0 and at most 100% per 30 days."
            }
          />
        </Toggle>
      ) : null}

      {state.mutableRecipient ? (
        <Toggle
          label="Change the recipient"
          on={changeRecipient}
          set={setChangeRecipient}
        >
          <Input
            value={recipient}
            placeholder={state.recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="rounded-none text-xs"
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            {recipientValid
              ? "Rent collected until it applies goes to the current recipient."
              : "Not a valid address."}
          </p>
        </Toggle>
      ) : null}

      {state.mutableTax ? (
        <Toggle
          label="Change the minimum runway"
          on={changeRunway}
          set={setChangeRunway}
        >
          <NumberField
            label="New minimum"
            suffix="hours"
            placeholder={String(Number(state.minRunwaySeconds) / 3600)}
            value={runway}
            onChange={setRunway}
            hint={
              runwayValid
                ? undefined
                : "A whole number of seconds, zero or more."
            }
          />
        </Toggle>
      ) : null}

      {state.mutableHook ? (
        <Toggle label="Change the hook" on={changeHook} set={setChangeHook}>
          <HookEditor
            hook={hook}
            onHook={(next) => {
              setHook(next);
              setHookData("");
              setHookConfigOk(true);
            }}
            onConfig={setHookData}
            onVerdict={setHookConfigOk}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            {hookTrimmed === ""
              ? "No hook detaches the current one and its fee."
              : "The hook checks its configuration and declares its own fee and permissions, when proposed and again when it attaches."}
          </p>
        </Toggle>
      ) : null}

      <div className="flex gap-2 border-t pt-2">
        <Button
          size="sm"
          disabled={!ready || actions.busy}
          onClick={() =>
            actions.proposeTerms(slot, {
              ...(changeTax ? { taxRateBps } : {}),
              ...(changeRecipient
                ? { recipient: recipientTrimmed as Address }
                : {}),
              ...(changeRunway ? { minRunwaySeconds: runwaySeconds } : {}),
              ...(changeHook
                ? {
                    hookTerms: {
                      target: hookAddress,
                      config:
                        hookAddress === zeroAddress ? ZERO_HOOK_DATA : data,
                    },
                  }
                : {}),
            })
          }
        >
          Propose
        </Button>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        A proposal never applies immediately. It waits for the next occupancy
        transition, so the occupant keeps the terms they bought into.
      </p>
    </Panel>
  );
}

/**
 * Pick the hook to propose: a known hook, a custom address, or none. A hook
 * that describes its configuration gets the same generated form as the create
 * page, checked against the hook on chain.
 */
function HookEditor({
  hook,
  onHook,
  onConfig,
  onVerdict,
}: {
  hook: string;
  onHook: (hook: string) => void;
  onConfig: (encoded: string) => void;
  onVerdict: (ok: boolean) => void;
}) {
  const { chainId } = useChain();
  const available = knownHooks[chainId] ?? [];
  const known = isAddress(hook) ? findKnownHook(chainId, hook as Address) : undefined;
  const [custom, setCustom] = useState(false);
  const [values, setValues] = useState<string[]>([]);
  const check = useHookCheck(hook, chainId);
  const { families } = useHookSchema(hook);
  const family = families.find((f) => f.fields.length > 0);

  const selectValue = custom ? "custom" : hook === "" ? "none" : (known?.address ?? "custom");

  return (
    <div className="space-y-1.5">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          setValues([]);
          if (v === "none") {
            setCustom(false);
            onHook("");
          } else if (v === "custom") {
            setCustom(true);
            onHook("");
          } else {
            setCustom(false);
            onHook(v);
          }
        }}
      >
        <SelectTrigger className="w-full rounded-none text-xs">
          <SelectValue placeholder="Select a hook" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No hook (detach)</SelectItem>
          {available.map((h) => (
            <SelectItem key={h.address} value={h.address}>
              {h.name}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom address</SelectItem>
        </SelectContent>
      </Select>

      {custom && (
        <Input
          value={hook}
          placeholder="0x…"
          onChange={(e) => {
            setValues([]);
            onHook(e.target.value.trim());
          }}
          className="rounded-none text-xs"
        />
      )}

      {check.data?.status === "ok" && (
        <HookPermissionRow permissions={check.data.permissions} fee={check.data.fee} />
      )}
      {check.data && check.data.status !== "ok" && (
        <p className="text-[10px] text-destructive">
          {check.data.status === "no-code"
            ? "No contract at this address on this chain."
            : check.data.status === "inert"
              ? "This hook asks for no permissions and cannot be attached."
              : "Not a hook — no hookOffer()."}
        </p>
      )}

      {family && (
        <div className="border-l-2 border-muted pl-3">
          <HookConfig
            hookAddress={hook}
            family={family}
            value={values}
            onChange={(next, encoded) => {
              setValues(next);
              onConfig(encoded ?? "");
            }}
            onVerdict={onVerdict}
          />
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  on,
  set,
  children,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-medium">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => set(e.target.checked)}
        />
        {label}
      </label>
      {on ? <div className="space-y-1">{children}</div> : null}
    </div>
  );
}

/** Hand the slot to another manager. Applies immediately. */
export function OwnershipPanel({
  slot,
  state,
  actions,
}: {
  slot: Address;
  state: SlotState;
  actions: Actions;
}) {
  const [manager, setManager] = useState("");
  const next = manager.trim();
  const valid =
    isAddress(next) &&
    next !== zeroAddress &&
    next.toLowerCase() !== state.manager.toLowerCase();

  return (
    <Panel
      icon={UserCog}
      title="Manager"
      tint="bg-rose-500/10 text-rose-600 dark:text-rose-400"
      subtitle={
        <span className="text-[10px] text-muted-foreground">manager only</span>
      }
    >
      <div className="space-y-1">
        <div className="flex gap-2">
          <Input
            value={manager}
            placeholder={state.manager}
            onChange={(e) => setManager(e.target.value)}
            className="rounded-none text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!valid || actions.busy}
            onClick={() => actions.setManager(slot, next as Address)}
          >
            Hand over
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          The new manager takes over every control here, immediately.
        </p>
      </div>
    </Panel>
  );
}

/**
 * The hook's current offer, when accepting it would change something. A new fee
 * applies at once; new callbacks wait for the next buy. The
 * button pins exactly the offer shown here.
 */
function HookOfferRow({
  slot,
  state,
  actions,
}: {
  slot: Address;
  state: SlotState;
  actions: Actions;
}) {
  const { data: status } = useQuery({
    queryKey: [
      "hook-offer-status",
      slot,
      state.hook,
      state.hookOffer.feeBps,
      state.hookOffer.permissions,
      state.pending.mask,
    ],
    queryFn: () => actions.client.hookOfferStatus(slot),
    enabled: state.hook !== zeroAddress,
  });

  if (!status || (!status.feeDiffers && !status.permissionsDiffer)) return null;
  const { accepted, offered } = status;
  const callbacks = (permissions: number) =>
    describePermissions(unpackHookPermissions(permissions)).granted.join(", ") || "none";

  return (
    <div className="space-y-1.5 border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs">
      <p className="font-medium">The hook offers new terms</p>
      {status.feeDiffers ? (
        <p className="text-muted-foreground">
          Fee: {formatBps(accepted.feeBps)} → {formatBps(offered.feeBps)} of
          rent
          {offered.feeBps > 0
            ? `, paid to ${offered.feeRecipient.slice(0, 6)}…${offered.feeRecipient.slice(-4)}`
            : ""}
          . Applies immediately; rent collected so far is paid under the
          current fee.
        </p>
      ) : null}
      {status.permissionsDiffer ? (
        <p className="text-muted-foreground">
          Permissions: {callbacks(accepted.permissions)} → {callbacks(offered.permissions)}.
          Applies at the next buy.
        </p>
      ) : null}
      <p className="text-muted-foreground">
        A hook whose offer is ignored may refuse service.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={actions.busy}
        onClick={() => actions.acceptHookOffer(slot, offered)}
      >
        Accept offer
      </Button>
    </div>
  );
}
