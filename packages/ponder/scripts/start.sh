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
# Give every deploy its own schema:
#
#   --schema <unique per deploy>   the tables this build owns
#
# The new deploy backfills into its own schema while the previous one keeps
# serving. No collision is possible, so no manual DROP.
#
# ── Views are OPT-IN ─────────────────────────────────────────────────────────
#
# `--views-schema public` looks tidy and is a trap when `public` already holds
# a previous app's TABLES: ponder tries to CREATE VIEW over them, Postgres says
#
#   error: "account" is not a view
#
# and it retries with backoff forever. Startup never completes, so the platform
# keeps routing to the old deploy and the new build silently never goes live.
#
# The GraphQL API reads from the app schema, not the views, so nothing needs
# them unless a SQL client reads `public` directly. Set VIEWS_SCHEMA to enable
# them — after making sure the target holds no tables of the same names.
#
# ── What this does NOT re-fetch ──────────────────────────────────────────────
#
# The RPC cache lives in a SEPARATE schema, `ponder_sync`. Its key carries no
# app, schema or build identity at all — from runtime/fragments.js:
#
#   log_<chainId>_<address>_<topic0..3>_<receipts>
#   factory_log_<chainId>_<address>_<eventSelector>_<loc>_<fromBlock>_<toBlock>
#
# So a per-deploy schema cannot invalidate it. Indexing functions DO re-run, and
# the progress display walks 0->100% again while they do — which is easy to read
# as a refetch when it is actually a replay out of Postgres.
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

VIEWS="${VIEWS_SCHEMA:-}"

if [ -z "$VIEWS" ] || [ "$SCHEMA" = "$VIEWS" ]; then
  echo "▸ ponder start --schema $SCHEMA"
  exec ponder start --schema "$SCHEMA"
fi

echo "▸ ponder start --schema $SCHEMA --views-schema $VIEWS"
exec ponder start --schema "$SCHEMA" --views-schema "$VIEWS"
