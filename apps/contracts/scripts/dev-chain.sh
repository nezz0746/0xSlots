#!/usr/bin/env bash
#
# The chain half of the local stack: anvil, protocol deployed, slots seeded.
#
#   pnpm dev:local                 # from the repo root, alongside indexer + app
#   ./scripts/dev-chain.sh         # standalone
#
# The indexer gates on the deployment JSON this writes, so ordering across the
# turbo tasks is handled by the filesystem rather than by turbo.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC="http://127.0.0.1:8545"
DEPLOYMENTS="$HERE/deployments/31337"
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

# Match the PROCESS NAME, not a guessed argument order. The old pattern was
# `pkill -f "anvil --block-time"`, which silently missed an anvil started as
# `anvil --chain-id 31337 --block-time 2` — the flags are in the wrong order for
# that substring to exist. The stale chain then kept port 8545, the new anvil
# failed to bind, and the deploy went into the OLD chain and died on a
# CreateCollision that names nothing about the real cause.
cleanup() { pkill -x anvil 2>/dev/null || true; }
trap cleanup EXIT INT TERM

pkill -x anvil 2>/dev/null || true

# Give the OS a moment to release the socket before we bind it.
sleep 0.5

# Refuse to continue if something still owns the port. Deploying into a chain
# this script did not create is never what was wanted.
if lsof -nP -iTCP:8545 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  port 8545 is already in use, and it is not ours." >&2
  echo "  Free it first:  lsof -nP -iTCP:8545 -sTCP:LISTEN" >&2
  exit 1
fi

# The deployment JSON is the indexer's start gate. Clearing it first means a
# restart can never leave the indexer pointed at the previous chain's factory.
rm -f "$DEPLOYMENTS"/*.json
mkdir -p "$DEPLOYMENTS"

echo "▸ anvil"
# --gas-limit is far above mainnet deliberately. forge's estimator returns a
# bogus ~1.05e9 for the native-currency createSlot — its ERC-20 siblings come in
# around 550k — and anvil rejects any tx whose limit exceeds the block limit.
# The transaction still burns ~550k; only the ceiling has to accommodate the
# estimate.
anvil --block-time 2 --gas-limit 2000000000 --silent &
ANVIL_PID=$!

# Bounded: an anvil that never binds should fail here, not hang forever.
for _ in $(seq 1 40); do
  cast block-number --rpc-url "$RPC" >/dev/null 2>&1 && break
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
    echo "  anvil exited before it was reachable — see the error above." >&2
    exit 1
  fi
  sleep 0.5
done
cast block-number --rpc-url "$RPC" >/dev/null 2>&1 || {
  echo "  anvil never became reachable on $RPC" >&2
  exit 1
}
echo "  up on $RPC"

cd "$HERE"

# One deploy path. There used to be two for this chain — DeploySlots with plain
# CREATE and DeployProtocol with CREATE2 — and they produced DIFFERENT
# addresses, so whichever ran last decided whether the app's pinned constants
# were right. DeployProtocol is the one CI and every testnet use; local uses it
# too, so a local address is a real address.
#
# Both steps run to completion in the foreground. Backgrounding them loses the
# race against the deployment JSON that everything downstream reads.
echo "▸ deploying"
forge script script/protocol/DeployProtocol.s.sol:DeployProtocol \
  --rpc-url "$RPC" --broadcast --private-key "$PK" >/tmp/deploy-local.log 2>&1 \
  || { echo "  deploy failed:"; tail -25 /tmp/deploy-local.log; exit 1; }

# Read the addresses back from the records the script wrote, rather than pinning
# them here. Constants in this file were the reason the two deploy paths could
# disagree without anything noticing.
addr() { python3 -c "import json;print(json.load(open('$DEPLOYMENTS/$1.json'))['address'])"; }
FACTORY=$(addr SlotFactory)

grep -E "^  (SlotFactory|OfferBook|SlotCollectiveFactory)" /tmp/deploy-local.log \
  | sed 's/^/  /' || true

# The app pins these addresses (packages/contracts/src/slots.ts). If CREATE2
# ever lands them somewhere else, say so here rather than three layers up as
# "the explorer is broken".
if [ "$(cast codesize "$FACTORY" --rpc-url "$RPC" 2>/dev/null || echo 0)" = "0" ]; then
  echo "  the factory record says $FACTORY but there is no code there." >&2
  exit 1
fi

echo "▸ seeding"
# SeedSlots deploys its own SlotsTestToken and reads the tenure hook out of the
# records the deploy just wrote, so the factory is the only address it needs.
forge script script/slots/SeedSlots.s.sol:SeedSlots \
  --rpc-url "$RPC" --broadcast --private-key "$PK" \
  --sig "run(address)" "$FACTORY" >/tmp/seed-local.log 2>&1 \
  || { echo "  seed failed:"; tail -25 /tmp/seed-local.log; exit 1; }
grep -E "^  [0-9] " /tmp/seed-local.log | sed 's/^/  /' || true

# The generated address table must match what the seed just deployed.
#
# `packages/sdk` and the create form read the local test token from
# `packages/contracts/src/generated.ts`, which `wagmi generate` writes FROM the
# records this run has just written. If the seed changed what it deploys, the
# committed table is a step behind and the app offers a token with no code —
# every ERC-20 approval then reverts with nothing naming the cause.
GEN="$HERE/../../packages/contracts/src/generated.ts"
TOKEN=$(addr SlotsTestToken)
if ! grep -qi "$TOKEN" "$GEN" 2>/dev/null; then
  echo >&2
  echo "  the seed's test token moved." >&2
  echo "    the seed just deployed  $TOKEN" >&2
  echo "    generated table has     $(grep -oE 'SlotsTestToken: \{ address: "0x[0-9a-fA-F]{40}"' "$GEN" 2>/dev/null | grep -oE '0x[0-9a-fA-F]{40}' || echo 'nothing')" >&2
  echo >&2
  echo "  Regenerate it:" >&2
  echo "    pnpm --filter @0xslots/contracts codegen" >&2
  echo "    pnpm --filter @0xslots/contracts build" >&2
  exit 1
fi

cat <<EOF

  chain ready — anvil on $RPC (chainId 31337)
  factory:  $FACTORY
  book:     $(addr OfferBook)
  accounts: anvil default mnemonic, indices 0-4
  time warp:
    cast rpc evm_increaseTime 604800 --rpc-url $RPC
    cast rpc evm_mine --rpc-url $RPC

EOF

wait $ANVIL_PID
