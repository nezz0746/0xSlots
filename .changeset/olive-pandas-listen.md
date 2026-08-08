---
"@0xslots/contracts": minor
---

Round the min-deposit floor and the tenure pre-payment UP, so a funding requirement cannot vanish at low prices.

`Slot._minDepositFor` and `MinimumTenurePolicy._taxFor` both computed a funding requirement with truncating integer division. Below a threshold price the result rounded to **zero**, so a slot whose creator explicitly required N seconds of funded runway could be taken, repriced, or drained with no funding at all. Both now use `Math.ceilDiv`.

The threshold was in raw token units, which is what makes this more than a dust-rounding curiosity: the same `(taxPercentage, minDepositSeconds)` pair was a real requirement in an 18-decimal token and no requirement at all in a low-decimal one. At 2%/month over 7 days of runway everything below 215 raw units was free — $0.000215 in USDC, but $2.15 in a 2-decimal stablecoin. Neither contract reads `decimals()`, so nothing on-chain could tell the difference. Rounding up makes "no deposit required" mean `minDepositSeconds == 0` and nothing else, in every currency.

Three core call sites depended on that floor — `buy()`, `selfAssess()`, and `withdraw()` — so the old behaviour allowed taking a slot with a zero deposit, repricing to dust while keeping no runway, and withdrawing an entire live position. `MinimumTenurePolicy.checkBuy` was worse in kind: a zero-funded buyer took the slot and the tenure window then locked everyone else out of it for the full duration. Liquidation ignores the policy and clears such an occupancy immediately, which is why this was a griefing surface rather than a theft vector.

**This is a breaking tightening.** `buy(account, 0, dustPrice)` on a slot with `minDepositSeconds > 0` succeeds today and will not afterwards, and a buy that exactly met a truncated floor may now be one unit short. Integrators computing a deposit client-side must round up the same way — a truncating copy will land one unit under and revert.

`_accrue` is deliberately left truncating. `topUp(0)` is permissionless and has no zero-amount guard, so anyone can force a settle for the price of gas; rounding accrual up would let them charge the occupant a unit they do not owe on every such call. Requirement floors checked once and accrual integrated over repeated calls want opposite rounding, and the regression suite pins that reasoning so a later sweep does not "complete the pattern" here.
