#!/usr/bin/env bash
#
# Production start.
#
# ── Why not just `--schema public` ───────────────────────────────────────────
#
# Ponder stamps each app schema with a `build_id` derived from the config and
# schema, and refuses to start when the stored id differs:
#
#   Schema "public" was previously used by a different Ponder app.
#
# That is not corruption — it is ponder declining to mix rows written by one
# version of the indexing logic with another. Any schema change (adding the feed
# tables, say) trips it, and on Railway the container then restart-loops.
#
# ── The fix ──────────────────────────────────────────────────────────────────
#
# Give every deploy its own schema and expose it through stable views:
#
#   --schema        <unique per deploy>   the tables this build owns
#   --views-schema  public                views the API and consumers read
#
# The new deploy backfills into its own schema while the previous one keeps
# serving, then the views flip. No collision is possible, so no manual DROP.
#
# ── What this does NOT re-fetch ──────────────────────────────────────────────
#
# The RPC cache lives in a SEPARATE schema, `ponder_sync`, keyed by chain rather
# than by app. A new app schema does not touch it, so ranges already fetched are
# replayed from Postgres rather than from the provider. Indexing functions do
# re-run — that is unavoidable, the tables are new — but that is CPU, not RPC.
#
# Genuinely new work still costs RPC: a source that did not exist before (the
# FeedHub and Feed contracts) has no cached logs for its address, and neither
# does an earlier startBlock.
#
# To confirm the cache survived a deploy:
#   select count(*) from ponder_sync.logs;

set -euo pipefail

# Precedence: an explicit name, else the Railway deploy id, else a local default.
SCHEMA="${DATABASE_SCHEMA:-${RAILWAY_DEPLOYMENT_ID:-ponder}}"
# Ponder caps schema names at 45 characters; Railway's deploy id is a UUID.
SCHEMA="${SCHEMA:0:45}"

VIEWS="${VIEWS_SCHEMA:-public}"

if [ "$SCHEMA" = "$VIEWS" ]; then
  # Nothing to point views at when they would target their own tables.
  echo "▸ ponder start --schema $SCHEMA"
  exec ponder start --schema "$SCHEMA"
fi

echo "▸ ponder start --schema $SCHEMA --views-schema $VIEWS"
exec ponder start --schema "$SCHEMA" --views-schema "$VIEWS"
