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
import { findKnownModule, knownModules } from "@0xslots/contracts/slots";
import { ModuleSettings } from "@/app/app/create/components/module-settings";
import { ModuleScopeRow } from "@/components/module-scopes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChain } from "@/context/chain";
import { useModuleCheck } from "@/hooks/use-module-check";
import { useModuleDefinition } from "@/hooks/use-module-schema";
import { describeScopes } from "@/lib/module-scopes";
import { NumberField, Panel } from "./panel";
import { QueuedTermsControls } from "./pending-updates";

type Actions = ReturnType<typeof useSlotsAction>;

/**
 * The manager's controls: every term queues and lands at the next occupancy
 * transition. The module is offered only when the slot did not lock it.
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
  const [module, setModule] = useState("");
  const [settings, setSettings] = useState("");
  const [settingsOk, setSettingsOk] = useState(true);
  const [changeTax, setChangeTax] = useState(false);
  const [changeRecipient, setChangeRecipient] = useState(false);
  const [changeRunway, setChangeRunway] = useState(false);
  const [changeModule, setChangeModule] = useState(false);

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

  // A blank module means DETACH, which is a real intention.
  const moduleTrimmed = module.trim();
  const moduleAddress = (
    moduleTrimmed === "" ? zeroAddress : moduleTrimmed
  ) as Address;
  const data = (settings.trim() || ZERO_SETTINGS) as Hex;
  const moduleValid =
    !changeModule ||
    moduleAddress === zeroAddress ||
    (isAddress(moduleAddress) && isHex(data) && data.length === 66 && settingsOk);

  const ready =
    (changeTax || changeRecipient || changeRunway || changeModule) &&
    taxValid &&
    recipientValid &&
    runwayValid &&
    moduleValid;

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

      <ModuleGrantRow slot={slot} state={state} actions={actions} />

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

      {state.mutableModule ? (
        <Toggle label="Change the module" on={changeModule} set={setChangeModule}>
          <ModuleEditor
            module={module}
            onModule={(next) => {
              setModule(next);
              setSettings("");
              setSettingsOk(true);
            }}
            onConfig={setSettings}
            onVerdict={setSettingsOk}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">
            {moduleTrimmed === ""
              ? "No module detaches the current one and its fee."
              : "The module checks its settings and declares its own fee and scopes, when proposed and again when it attaches."}
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
              ...(changeModule
                ? {
                    moduleTerms: {
                      target: moduleAddress,
                      settings:
                        moduleAddress === zeroAddress ? ZERO_SETTINGS : data,
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
 * Pick the module to propose: a known module, a custom address, or none. A module
 * that describes its configuration gets the same generated form as the create
 * page, checked against the module on chain.
 */
function ModuleEditor({
  module,
  onModule,
  onConfig,
  onVerdict,
}: {
  module: string;
  onModule: (module: string) => void;
  onConfig: (encoded: string) => void;
  onVerdict: (ok: boolean) => void;
}) {
  const { chainId } = useChain();
  const available = knownModules[chainId] ?? [];
  const known = isAddress(module) ? findKnownModule(chainId, module as Address) : undefined;
  const [custom, setCustom] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const check = useModuleCheck(module, chainId);
  const { definition } = useModuleDefinition(module);
  const config = definition?.settings?.fields.length ? definition.settings : undefined;

  const selectValue = custom ? "custom" : module === "" ? "none" : (known?.address ?? "custom");

  return (
    <div className="space-y-1.5">
      <Select
        value={selectValue}
        onValueChange={(v) => {
          setValues({});
          if (v === "none") {
            setCustom(false);
            onModule("");
          } else if (v === "custom") {
            setCustom(true);
            onModule("");
          } else {
            setCustom(false);
            onModule(v);
          }
        }}
      >
        <SelectTrigger className="w-full rounded-none text-xs">
          <SelectValue placeholder="Select a module" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No module (detach)</SelectItem>
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
          value={module}
          placeholder="0x…"
          onChange={(e) => {
            setValues({});
            onModule(e.target.value.trim());
          }}
          className="rounded-none text-xs"
        />
      )}

      {check.data?.status === "ok" && (
        <ModuleScopeRow scopes={check.data.scopes} fee={check.data.fee} />
      )}
      {check.data && check.data.status !== "ok" && (
        <p className="text-[10px] text-destructive">
          {check.data.status === "no-code"
            ? "No contract at this address on this chain."
            : check.data.status === "inert"
              ? "This module asks for no scopes and cannot be attached."
              : "Not a module — no manifest()."}
        </p>
      )}

      {config && (
        <div className="border-l-2 border-muted pl-3">
          <ModuleSettings
            moduleAddress={module}
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
 * The module's current manifest, when granting it would change something. A new
 * fee applies at once; new scopes wait for the next buy. The button pins
 * exactly the manifest shown here.
 */
function ModuleGrantRow({
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
      "module-grant-status",
      slot,
      state.module,
      state.manifest.feeBps,
      state.manifest.scopes,
      state.pending.mask,
    ],
    queryFn: () => actions.client.grantStatus(slot),
    enabled: state.module !== zeroAddress,
  });

  if (!status || (!status.feeDiffers && !status.scopesDiffer)) return null;
  const { accepted, declared } = status;
  const callbacks = (scopes: number) =>
    describeScopes(unpackScopes(scopes)).granted.join(", ") || "none";

  return (
    <div className="space-y-1.5 border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs">
      <p className="font-medium">The module has new terms</p>
      {status.feeDiffers ? (
        <p className="text-muted-foreground">
          Fee: {formatBps(accepted.feeBps)} → {formatBps(declared.feeBps)} of
          rent
          {declared.feeBps > 0
            ? `, paid to ${declared.feeRecipient.slice(0, 6)}…${declared.feeRecipient.slice(-4)}`
            : ""}
          . Applies immediately; rent collected so far is paid under the
          current fee.
        </p>
      ) : null}
      {status.scopesDiffer ? (
        <p className="text-muted-foreground">
          Scopes: {callbacks(accepted.scopes)} → {callbacks(declared.scopes)}.
          Applies at the next buy.
        </p>
      ) : null}
      <p className="text-muted-foreground">
        A module whose update is ignored may refuse service.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={actions.busy}
        onClick={() => actions.grant(slot, declared)}
      >
        Accept update
      </Button>
    </div>
  );
}
