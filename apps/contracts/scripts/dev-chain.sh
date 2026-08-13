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

cleanup() { pkill -f "anvil --block-time" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

pkill -f "anvil --block-time" 2>/dev/null || true

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

until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do sleep 0.5; done
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
