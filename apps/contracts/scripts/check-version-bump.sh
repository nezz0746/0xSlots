#!/usr/bin/env bash
#
# An upgradeable contract whose bytecode changed must raise its version().
#
#   ./scripts/check-version-bump.sh <base-sha>
#
# Catches the two upgrades that fail silently: shipping code identical to what
# is deployed, and shipping OLDER code off a stale branch. Neither reverts on
# its own, and both look like a successful upgrade.
set -euo pipefail
cd "$(dirname "$0")/.."
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

BASE="${1:?usage: check-version-bump.sh <base-sha>}"

# Only the upgradeable ones. A stateless periphery contract is replaced, not
# upgraded, so its version is not load-bearing.
declare -a WATCH=(
  "src/Slot.sol"
  "src/SlotFactory.sol"
  "src/periphery/book/OfferBook.sol"
  "src/collectives/SlotCollective.sol"
  "src/collectives/SlotCollectiveFactory.sol"
)

fail=0
for f in "${WATCH[@]}"; do
  # Did anything this contract compiles from change? Its own file is a proxy
  # for that; a base-layer change is caught by the layout snapshot instead.
  if git diff --quiet "$BASE" -- "$f"; then continue; fi

  # `|| true` on both: under `set -e` with pipefail, a grep that matches
  # nothing kills the script — and "this contract had no version before" is a
  # case we handle, not a failure.
  old=$(git show "$BASE:apps/contracts/$f" 2>/dev/null \
        | grep -A 2 "function version()" | grep -oE "return [0-9]+" \
        | grep -oE "[0-9]+" | head -1 || true)
  new=$(grep -A 2 "function version()" "$f" \
        | grep -oE "return [0-9]+" | grep -oE "[0-9]+" | head -1 || true)

  # A contract that did not have a version before is new — nothing to compare.
  if [[ -z "${old:-}" ]]; then
    echo "  $f: new (version ${new:-?})"
    continue
  fi

  if [[ -z "${new:-}" ]]; then
    echo "  $f: CHANGED but has no version()"; fail=1; continue
  fi

  if (( new > old )); then
    echo "  $f: $old -> $new"
  else
    echo "  $f: CHANGED but version is still $new — bump it in this commit"
    fail=1
  fi
done

if (( fail )); then
  echo ""
  echo "An upgrade ships code, and version() is how anyone tells which code is"
  echo "live. Raise it in the same commit as the change."
  exit 1
fi
echo "version bumps OK"
