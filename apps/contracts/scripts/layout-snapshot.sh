#!/usr/bin/env bash
#
# Storage layout snapshots for every upgradeable contract.
#
#   ./scripts/layout-snapshot.sh          # write
#   ./scripts/layout-snapshot.sh --check  # fail if they moved
#
# Why a committed snapshot as well as the OZ validator: the validator answers
# "is this upgrade safe against the reference contract", which is the right
# question at upgrade time. The snapshot answers "did this PR move a slot",
# which is the right question in review — it puts the change in the diff,
# where a human sees it, instead of in a tool's output that nobody reads.
set -euo pipefail
cd "$(dirname "$0")/.."
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

CONTRACTS=(
  "src/Slot.sol:Slot"
  "src/SlotFactory.sol:SlotFactory"
  "src/periphery/book/OfferBook.sol:OfferBook"
  "src/collectives/SlotCollective.sol:SlotCollective"
  "src/collectives/SlotCollectiveFactory.sol:SlotCollectiveFactory"
)

OUT=storage-layout.txt
TMP=$(mktemp)

# `forge inspect` needs a fresh artifact for the layout to be emitted at all —
# a stale one reports "storage layout missing", which reads like a tool bug and
# is really a caching one.
forge clean >/dev/null 2>&1
forge build --extra-output storageLayout >/dev/null 2>&1

for c in "${CONTRACTS[@]}"; do
  echo "### $c" >> "$TMP"
  # Name / slot / offset / bytes only. The Contract column carries the file
  # path, which changes when a file moves and would make every rename look
  # like a storage change.
  forge inspect "$c" storage 2>/dev/null \
    | awk -F'|' 'NF>5 && $2!~/Name/ {
        gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$4);
        gsub(/^ +| +$/,"",$5); gsub(/^ +| +$/,"",$6);
        print $2" | slot "$4" | offset "$5" | "$6" bytes"
      }' >> "$TMP"
  echo "" >> "$TMP"
done

if [[ "${1:-}" == "--check" ]]; then
  if ! diff -u "$OUT" "$TMP"; then
    echo ""
    echo "Storage layout changed. If that is intended and APPEND-ONLY, run:"
    echo "  ./scripts/layout-snapshot.sh"
    echo "and commit the result so the move is visible in review."
    exit 1
  fi
  echo "storage layout unchanged"
else
  mv "$TMP" "$OUT"
  echo "wrote $OUT"
fi
