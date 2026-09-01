"use client";

import type { SignedSellOrder, SlotState } from "@0xslots/sdk/slots";
import { Check, Copy, FileSignature } from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CurrencyMeta } from "@/hooks/slots/use-slots";
import type { useSlotsAction } from "@/hooks/slots/use-slots-action";
import { toRawUnits } from "@/utils";
import { NumberField, Panel } from "./panel";

type Actions = ReturnType<typeof useSlotsAction>;

/** JSON with the bigints stringified, so an order survives a copy-paste. */
function encodeOrder(signed: SignedSellOrder): string {
  return JSON.stringify(
    {
      order: {
        slot: signed.order.slot,
        buyer: signed.order.buyer,
        price: signed.order.price.toString(),
        deposit: signed.order.deposit.toString(),
        nonce: signed.order.nonce.toString(),
        deadline: signed.order.deadline.toString(),
      },
      signature: signed.signature,
    },
    null,
    2,
  );
}

function decodeOrder(raw: string): SignedSellOrder | null {
  try {
    const parsed = JSON.parse(raw);
    const o = parsed.order;
    if (!o || typeof parsed.signature !== "string") return null;
    return {
      order: {
        slot: o.slot,
        buyer: o.buyer,
        price: BigInt(o.price),
        deposit: BigInt(o.deposit),
        nonce: BigInt(o.nonce),
        deadline: BigInt(o.deadline),
      },
      signature: parsed.signature,
    };
  } catch {
    return null;
  }
}

/**
 * The signed-order channel: a buyer states terms, the occupant fills them.
 *
 * The buyer chooses `price` AND `deposit` and both are in the digest, so the
 * occupant cannot rebook the escrow half as proceeds and seat the buyer
 * insolvent. Signing is free; the only transaction is the occupant's.
 *
 * ERC-20 only, and the SDK refuses rather than letting it fail on chain:
 * filling pulls the buyer's funds on an allowance, and native ETH has none.
 */
export function SellOrderPanel({
  slot,
  state,
  currency,
  actions,
  isOccupant,
}: {
  slot: Address;
  state: SlotState;
  currency: CurrencyMeta;
  actions: Actions;
  isOccupant: boolean;
}) {
  const { isConnected } = useAccount();
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [hours, setHours] = useState("24");
  const [nonce, setNonce] = useState("");
  const [signed, setSigned] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);

  const parsed = decodeOrder(paste);

  if (currency.isNative)
    return (
      <Panel
        icon={FileSignature}
        title="Signed sell orders"
        tint="bg-slate-500/10 text-slate-600 dark:text-slate-400"
      >
        <p className="text-xs leading-snug text-muted-foreground">
          Unavailable on a native-ETH slot. Filling an order pulls the buyer's
          funds on an ERC-20 allowance, and native ETH has none — so the order
          could never execute. Buying directly still works.
        </p>
      </Panel>
    );

  return (
    <Panel
      icon={FileSignature}
      title="Signed sell orders"
      tint="bg-slate-500/10 text-slate-600 dark:text-slate-400"
    >
      {!isOccupant ? (
        <>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Offer the occupant terms to hand you the slot. Signing is{" "}
            <strong className="font-medium text-foreground">
              free and instant
            </strong>{" "}
            — you approve the token once, then sign. Only the occupant pays gas.
          </p>
          <NumberField
            label="Price you offer"
            suffix={currency.symbol}
            value={price}
            onChange={setPrice}
          />
          <NumberField
            label="Deposit you fund"
            suffix={currency.symbol}
            value={deposit}
            onChange={setDeposit}
            hint="Both halves are in the signature, so the split cannot be rewritten by whoever fills it."
          />
          <NumberField
            label="Valid for"
            suffix="hours"
            value={hours}
            onChange={setHours}
          />
          <Button
            size="sm"
            className="w-full"
            disabled={
              !isConnected ||
              actions.busy ||
              toRawUnits(price, currency.decimals) <= 0n
            }
            onClick={async () => {
              const result = await actions.makeSellOrder(slot, {
                price: toRawUnits(price, currency.decimals),
                deposit: toRawUnits(deposit, currency.decimals),
                deadline: BigInt(
                  Math.floor(Date.now() / 1000) +
                    Math.max(1, Number(hours) || 24) * 3600,
                ),
              });
              if (result) setSigned(encodeOrder(result));
            }}
          >
            Sign order — free, no gas
          </Button>

          {signed ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium">Your signed order</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(signed);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  Copy
                </Button>
              </div>
              <textarea
                readOnly
                value={signed}
                rows={8}
                className="w-full border bg-muted/40 p-2 font-mono text-[10px]"
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                Send this to the occupant. It is a standing authorisation:
                deleting your copy revokes nothing — burn the nonce below to
                kill every copy at once.
              </p>
            </div>
          ) : null}

          <div className="flex gap-0 border-t pt-2">
            <Input
              value={nonce}
              inputMode="numeric"
              placeholder="nonce"
              onChange={(e) => setNonce(e.target.value)}
              className="rounded-none"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-none border-l-0"
              disabled={nonce === "" || actions.busy}
              onClick={() => actions.cancelSellOrder(slot, BigInt(nonce))}
            >
              Burn nonce
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Paste an order a buyer signed for this slot. You need no allowance of
            your own — theirs is what gets pulled.
          </p>
          <textarea
            value={paste}
            rows={8}
            placeholder='{ "order": { … }, "signature": "0x…" }'
            onChange={(e) => setPaste(e.target.value)}
            className="w-full border bg-background p-2 font-mono text-[10px]"
          />
          {paste && !parsed ? (
            <p className="text-[10px] text-destructive">
              Not a signed order this app can read.
            </p>
          ) : null}
          {parsed && parsed.order.slot.toLowerCase() !== slot.toLowerCase() ? (
            <p className="text-[10px] text-destructive">
              This order is for a different slot. It cannot be filled here — a
              signature is bound to one slot's domain.
            </p>
          ) : null}
          <Button
            size="sm"
            className="w-full"
            disabled={
              !parsed ||
              actions.busy ||
              parsed.order.slot.toLowerCase() !== slot.toLowerCase() ||
              state.isVacant
            }
            onClick={() =>
              parsed && actions.sell(slot, parsed.order, parsed.signature)
            }
          >
            Sell on these terms
          </Button>
        </>
      )}
    </Panel>
  );
}
