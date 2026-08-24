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

# Kill by PID, not by pattern: the flags this script happens to pass are not
# what makes a process ours.
cleanup() { [ -n "${ANVIL_PID:-}" ] && kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# ── Clearing the port ────────────────────────────────────────────────────────
#
# This was `pkill -f "anvil --block-time"`, which matched only anvils started
# BY THIS SCRIPT. An `anvil --silent` left running from another session sailed
# through it, and every consequence downstream was silent:
#
#   * the bind below fails inside a background job, where `set -e` never sees
#     the exit code
#   * the readiness loop is then answered by the OLD chain, so the script
#     reports "up on 127.0.0.1:8545" and continues
#   * the deploy reverts with CreateCollision, because the CREATE2 addresses it
#     wants are already occupied on a chain days older than this run
#
# `pkill -x` matches the process name whatever its arguments, so any anvil goes.
# Anything else holding the port is not ours to kill — say who has it and stop,
# the same way scripts/dev-index.sh does for 42069.
pkill -x anvil 2>/dev/null || true
for _ in $(seq 20); do lsof -ti:8545 >/dev/null 2>&1 || break; sleep 0.2; done
if lsof -ti:8545 >/dev/null 2>&1; then
  echo "port 8545 is held by something that is not anvil:"
  lsof -i:8545 | tail -n +2 | sed 's/^/  /'
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

# The liveness check is on OUR anvil, not on the port. Waiting for the port
# alone is what let a stranger's chain pass for a fresh one.
until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do
  kill -0 "$ANVIL_PID" 2>/dev/null || {
    echo "  anvil exited before it was reachable — $RPC already in use?"
    lsof -i:8545 2>/dev/null | tail -n +2 | sed 's/^/  /'
    exit 1
  }
  sleep 0.5
done
echo "  up on $RPC (pid $ANVIL_PID)"

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
