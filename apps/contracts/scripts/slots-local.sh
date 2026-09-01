#!/usr/bin/env bash
#
# Bring up a local chain with the Slots protocol deployed and seeded.
#
#   ./scripts/slots-local.sh          # seed if the chain is empty, else leave it
#   ./scripts/slots-local.sh --reset  # wipe and rebuild from scratch
#
# Restarting anvil by hand wipes the deployment and leaves the app talking to a
# chain with no contracts on it — which reads as a client bug from every side.
# Run this instead; it is idempotent, so running it when everything is already
# up costs one eth_getCode and changes nothing.
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
PK=${PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
FACTORY=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
HOOK=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
TOKEN=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--reset" ]]; then
  echo "── resetting anvil ──"
  pkill -x anvil 2>/dev/null || true
  sleep 1
fi

if ! cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "── starting anvil ──"
  nohup anvil --chain-id 31337 --block-time 1 >/tmp/anvil-slots.log 2>&1 &
  for _ in $(seq 1 40); do
    cast block-number --rpc-url "$RPC" >/dev/null 2>&1 && break
    sleep 0.5
  done
  cast block-number --rpc-url "$RPC" >/dev/null 2>&1 || {
    echo "anvil did not come up; see /tmp/anvil-slots.log" >&2; exit 1; }
fi

# The addresses are deterministic from a fresh chain driven by account 0, so
# code at the factory is a reliable "already seeded" check.
if [[ "$(cast codesize "$FACTORY" --rpc-url "$RPC" 2>/dev/null || echo 0)" != "0" ]]; then
  # The deploy is what writes deployments/31337/*.json, and the indexer's dev
  # loop waits on those — so a warm chain with the files deleted would hang it
  # forever. Restore the one it gates on rather than redeploying.
  DEPLOY_FILE=deployments/31337/SlotFactory.json
  if [[ ! -f "$DEPLOY_FILE" ]]; then
    mkdir -p "$(dirname "$DEPLOY_FILE")"
    printf '{"address":"%s","startBlock":0}\n' "$FACTORY" > "$DEPLOY_FILE"
    echo "restored $DEPLOY_FILE"
  fi
  echo "already deployed — factory $FACTORY, $(cast call "$FACTORY" 'slotCount()(uint256)' --rpc-url "$RPC") slots"
  exit 0
fi

echo "── deploying ──"
forge script script/slots/DeploySlots.s.sol:DeploySlots \
  --rpc-url "$RPC" --broadcast --private-key "$PK" >/dev/null

echo "── seeding ──"
forge script script/slots/SeedSlots.s.sol:SeedSlots \
  --rpc-url "$RPC" --broadcast --private-key "$PK" \
  --sig "run(address,address,address)" "$FACTORY" "$HOOK" "$TOKEN" >/dev/null

COUNT=$(cast call "$FACTORY" 'slotCount()(uint256)' --rpc-url "$RPC")
[[ "$COUNT" == "7" ]] || { echo "expected 7 slots, got $COUNT" >&2; exit 1; }

echo
echo "  factory   $FACTORY"
echo "  hook      $HOOK"
echo "  token     $TOKEN"
echo "  slots     $COUNT"
