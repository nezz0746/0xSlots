#!/usr/bin/env bash
#
# The chain half of the local stack: anvil, protocol deployed, slots seeded.
#
# Run via `pnpm dev:local` at the repo root — turbo starts this alongside the
# indexer and the app. Standalone it is fine too; the indexer gates on the
# deployment JSON this writes, so ordering is handled by the filesystem rather
# than by turbo.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC="http://127.0.0.1:8545"
DEPLOYMENTS="$HERE/deployments/31337"

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
# this script did not create is never what was wanted: the addresses are pinned
# to a clean nonce sequence, so the failure surfaces much later and much less
# legibly than it does here.
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

# Both scripts run to completion in the foreground. Backgrounding them loses the
# race against the deployment JSON that everything downstream reads.
echo "▸ deploying"
cd "$HERE"
forge script script/DeployLocal.s.sol:DeployLocal --broadcast >/tmp/deploy-local.log 2>&1 \
  || { echo "  deploy failed:"; tail -25 /tmp/deploy-local.log; exit 1; }
grep -E "proxy:" /tmp/deploy-local.log | sed 's/^/  /'

echo "▸ seeding"
forge script script/SeedLocal.s.sol:SeedLocal --broadcast >/tmp/seed-local.log 2>&1 \
  || { echo "  seed failed:"; tail -25 /tmp/seed-local.log; exit 1; }
grep -E "^  (slot|LocalToken)" /tmp/seed-local.log | sed 's/^/  /'

cat <<EOF

  chain ready — anvil on $RPC (chainId 31337)
  accounts: anvil default mnemonic, indices 0-4
  time warp:
    cast rpc evm_increaseTime 604800 --rpc-url $RPC
    cast rpc evm_mine --rpc-url $RPC

EOF

wait $ANVIL_PID
