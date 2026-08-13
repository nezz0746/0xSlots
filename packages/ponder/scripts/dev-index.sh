#!/usr/bin/env bash
#
# The indexer half of the local stack.
#
# Waits for the chain script to publish deployments/31337/SlotFactory.json, then
# indexes anvil. Gating on that file rather than on turbo ordering is what makes
# the two halves independently restartable: `turbo` starts both at once, and
# this one simply blocks until the other has something worth indexing.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT="$HERE/../../apps/contracts/deployments/31337/SlotFactory.json"
RPC="${ANVIL_RPC_URL:-http://127.0.0.1:8545}"

# A second instance binds 42069 alongside the first and requests land on
# whichever wins the accept race. The symptom is an intermittent 500 from /ready
# and nulls for non-nullable GraphQL fields, which reads as a schema bug rather
# than as a duplicate process — so refuse outright.
pkill -f "ponder dev" 2>/dev/null || true
sleep 1
if lsof -ti:42069 >/dev/null 2>&1; then
  echo "port 42069 is already held:"
  lsof -i:42069 | tail -n +2 | sed 's/^/  /'
  exit 1
fi

echo "▸ waiting for anvil"
until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do sleep 1; done

echo "▸ waiting for the local deploy"
until [ -f "$DEPLOYMENT" ]; do sleep 1; done

# Ponder's store describes a chain that no longer exists once anvil restarts:
# the block numbers repeat with different contents, so a warm store silently
# indexes a mix of two chains.
rm -rf "$HERE/.ponder"

cd "$HERE"
exec env PONDER_LOCAL=1 pnpm exec ponder dev
