"use client";

import {
  type SlotState,
  unpackScopes,
  ZERO_SETTINGS,
} from "@0xslots/sdk/slots";
import { useQuery } from "@tanstack/react-query";
import { Settings2, UserCog } from "lucide-react";
import { useState } from "react";
import { type Address, type Hex, isAddress, isHex, zeroAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { formatBps } from "@/utils";
import { findKnownApp, knownApps } from "@0xslots/contracts/slots";
import { HookConfig } from "@/app/app/create/components/app-config";
import { AppScopeRow } from "@/components/app-scopes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChain } from "@/context/chain";
import { useAppCheck } from "@/hooks/use-app-check";
import { useAppDefinition } from "@/hooks/use-app-schema";
import { describePermissions } from "@/lib/app-scopes";
import { NumberField, Panel } from "./panel";
import { QueuedTermsControls } from "./pending-updates";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * The manager's controls: every term queues and lands at the next occupancy
 * transition. The app is offered only when the slot did not lock it.
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
  const [app, setHook] = useState("");
  const [settings, setHookData] = useState("");
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

  // A blank app means DETACH, which is a real intention.
  const hookTrimmed = app.trim();
  const hookAddress = (
    hookTrimmed === "" ? zeroAddress : hookTrimmed
  ) as Address;
  const data = (settings.trim() || ZERO_SETTINGS) as Hex;
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

      {state.mutableApp ? (
        <Toggle label="Change the app" on={changeHook} set={setChangeHook}>
          <HookEditor
            app={app}
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
              ? "No app detaches the current one and its fee."
              : "The app checks its configuration and declares its own fee and scopes, when proposed and again when it attaches."}
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
                    appTerms: {
                      target: hookAddress,
                      settings:
                        hookAddress === zeroAddress ? ZERO_SETTINGS : data,
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
 * Pick the app to propose: a known app, a custom address, or none. An app
 * that describes its configuration gets the same generated form as the create
 * page, checked against the app on chain.
 */
function HookEditor({
  app,
  onHook,
  onConfig,
  onVerdict,
}: {
  app: string;
  onHook: (app: string) => void;
  onConfig: (encoded: string) => void;
  onVerdict: (ok: boolean) => void;
}) {
  const { chainId } = useChain();
  const available = knownApps[chainId] ?? [];
  const known = isAddress(app) ? findKnownApp(chainId, app as Address) : undefined;
  const [custom, setCustom] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const check = useAppCheck(app, chainId);
  const { definition } = useAppDefinition(app);
  const config = definition?.config?.fields.length ? definition.config : undefined;

  const selectValue = custom ? "custom" : app === "" ? "none" : (known?.address ?? "custom");

  return (
    <div className="space-y-1.5">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          setValues({});
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
          <SelectValue placeholder="Select an app" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No app (detach)</SelectItem>
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
          value={app}
          placeholder="0x…"
          onChange={(e) => {
            setValues({});
            onHook(e.target.value.trim());
          }}
          className="rounded-none text-xs"
        />
      )}

      {check.data?.status === "ok" && (
        <AppScopeRow scopes={check.data.scopes} fee={check.data.fee} />
      )}
      {check.data && check.data.status !== "ok" && (
        <p className="text-[10px] text-destructive">
          {check.data.status === "no-code"
            ? "No contract at this address on this chain."
            : check.data.status === "inert"
              ? "This app asks for no scopes and cannot be attached."
              : "Not an app — no manifest()."}
        </p>
      )}

      {config && (
        <div className="border-l-2 border-muted pl-3">
          <HookConfig
            hookAddress={app}
            config={config}
            values={values}
            onChange={(next, word) => {
              setValues(next);
              onConfig(word ?? "");
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
 * The app's current offer, when accepting it would change something. A new fee
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
      "app-offer-status",
      slot,
      state.app,
      state.manifest.feeBps,
      state.manifest.scopes,
      state.pending.mask,
    ],
    queryFn: () => actions.client.grantStatus(slot),
    enabled: state.app !== zeroAddress,
  });

  if (!status || (!status.feeDiffers && !status.scopesDiffer)) return null;
  const { accepted, offered } = status;
  const callbacks = (scopes: number) =>
    describePermissions(unpackScopes(scopes)).granted.join(", ") || "none";

  return (
    <div className="space-y-1.5 border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs">
      <p className="font-medium">The app offers new terms</p>
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
      {status.scopesDiffer ? (
        <p className="text-muted-foreground">
          Scopes: {callbacks(accepted.scopes)} → {callbacks(offered.scopes)}.
          Applies at the next buy.
        </p>
      ) : null}
      <p className="text-muted-foreground">
        An app whose offer is ignored may refuse service.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={actions.busy}
        onClick={() => actions.grant(slot, offered)}
      >
        Accept offer
      </Button>
    </div>
  );
}
