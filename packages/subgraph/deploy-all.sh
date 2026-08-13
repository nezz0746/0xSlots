#!/bin/bash
set -euo pipefail

# Deploy the 0xSlots subgraph to every network at one version label.
#
# Usage: ./deploy-all.sh <version>
# Example: ./deploy-all.sh 8.1.0
#
# ── What this does, and what it does NOT do ─────────────────────────────────
# This deploys to Subgraph STUDIO. Studio starts indexing immediately and
# serves the result at its own api.studio.thegraph.com endpoint.
#
# It does NOT publish to the decentralized network, and publishing is not the
# last step either. The gateway URLs the SDK reads
# (gateway.thegraph.com/api/subgraphs/id/…) serve whichever deployment
# INDEXERS have allocated to. A freshly published version is not queried there
# until an indexer picks it up and syncs it from startBlock — which for these
# subgraphs means millions of blocks, so hours rather than minutes.
#
# The deployment hash printed in the summary below is how you follow that:
#   https://gateway.thegraph.com/api/deployments/id/<hash>
# errors until an indexer has it, then reports _meta.block climbing.

VERSION=${1:?"Usage: ./deploy-all.sh <version> (e.g. 8.1.0)"}

if ! [[ "$VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "✗ '$VERSION' does not look like a version (expected e.g. 8.1.0 or v8.1.0)" >&2
  exit 1
fi

NETWORKS=("base-sepolia" "base")

# network|studioName|deploymentHash, filled in as we go.
SUMMARY=()

echo "🔺 Deploying 0xSlots subgraph $VERSION to Studio for: ${NETWORKS[*]}"
echo ""

for NETWORK in "${NETWORKS[@]}"; do
  STUDIO_NAME=$(node -p "require('./config/${NETWORK}.json').studioName")
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📡 $NETWORK → $STUDIO_NAME ($VERSION)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Generate subgraph.yaml from template.
  #
  # Rendered to a temp file and checked before it replaces the real manifest.
  # `pnpm exec` nested inside a `pnpm run` script prints workspace warnings on
  # STDOUT — standalone it uses stderr — so a bare `> subgraph.yaml` silently
  # captured one as line 1 and `graph codegen` died on a YAMLException about a
  # document separator, which points nowhere near the actual cause.
  RENDERED=$(mktemp)
  pnpm exec mustache "config/${NETWORK}.json" subgraph.template.yaml > "$RENDERED"

  if ! head -1 "$RENDERED" | grep -q '^specVersion:'; then
    echo "✗ Rendered manifest for $NETWORK does not start with specVersion." >&2
    echo "  Something wrote to stdout ahead of mustache. First 3 lines:" >&2
    head -3 "$RENDERED" >&2
    rm -f "$RENDERED"
    exit 1
  fi

  mv "$RENDERED" subgraph.yaml
  echo "✓ Generated subgraph.yaml"

  # Codegen + build
  pnpm exec graph codegen
  pnpm exec graph build
  echo "✓ Built"

  # Deploy. Output is teed so it still streams while we keep a copy to pull
  # the deployment hash out of — without it there is no way to tell which
  # build the network is serving, which is the whole difficulty when a
  # published version has not been picked up yet.
  DEPLOY_LOG=$(mktemp)
  pnpm exec graph deploy "$STUDIO_NAME" --version-label "$VERSION" 2>&1 | tee "$DEPLOY_LOG"

  # Anchor on "Build completed:", which carries the manifest hash. `graph
  # deploy` also prints a hash per file as it uploads to IPFS, so taking the
  # last match in the log would sometimes pick one of those instead.
  HASH=$(grep -oE 'Build completed: *Qm[1-9A-HJ-NP-Za-km-z]{44}' "$DEPLOY_LOG" |
    grep -oE 'Qm[1-9A-HJ-NP-Za-km-z]{44}' | tail -1 || true)
  [ -n "$HASH" ] ||
    HASH=$(grep -oE 'Qm[1-9A-HJ-NP-Za-km-z]{44}' "$DEPLOY_LOG" | tail -1 || true)
  rm -f "$DEPLOY_LOG"
  [ -n "$HASH" ] || HASH="(not found in output)"

  SUMMARY+=("$NETWORK|$STUDIO_NAME|$HASH")
  echo "✅ $NETWORK deployed — $HASH"
  echo ""
done

echo "🎉 All networks deployed to Studio at $VERSION"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deployment hashes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for ROW in "${SUMMARY[@]}"; do
  IFS='|' read -r N S H <<< "$ROW"
  printf "  %-14s %-26s %s\n" "$N" "$S" "$H"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Studio is already indexing these — query them now at the"
echo "  api.studio.thegraph.com endpoint printed above."
echo ""
echo "  To reach the gateway URLs the SDK uses, publish each version in"
echo "  Studio, with signal auto-migration ON. Publishing alone does not"
echo "  route queries: an indexer must allocate to the new deployment and"
echo "  sync it from startBlock first."
echo ""
echo "  Track that per network. The gateway needs an API key AND a POST body —"
echo "  a plain GET returns 'auth error: missing authorization header'."
echo ""
echo "    export SUBGRAPH_API_KEY=..."
for ROW in "${SUMMARY[@]}"; do
  IFS='|' read -r N S H <<< "$ROW"
  [ "$H" != "(not found in output)" ] || continue
  echo ""
  echo "    # $N"
  echo "    curl -s -X POST https://gateway.thegraph.com/api/deployments/id/$H \\"
  echo "      -H \"Authorization: Bearer \$SUBGRAPH_API_KEY\" \\"
  echo "      -H 'Content-Type: application/json' \\"
  echo "      -d '{\"query\":\"{ _meta { block { number } } hasIndexingErrors } }\"}'"
done
echo ""
echo "  Errors until an indexer has the deployment; then _meta.block climbs"
echo "  toward the chain head as it syncs."
