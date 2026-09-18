#!/usr/bin/env bash
# Starts a cloudflared quick tunnel to the local API (localhost:4000) and
# points Resend's inbound webhook at it automatically.
#
# Why this exists: a cloudflared "quick tunnel" (no Cloudflare account) gets
# a BRAND NEW random *.trycloudflare.com URL every time it starts — there is
# no way around that without a paid/authenticated named tunnel. Previously,
# someone ran the plain `cloudflared tunnel --url ...` command by hand, and
# once that process died (machine restart, terminal closed, whatever), the
# webhook in Resend's dashboard was left pointing at a dead URL — silently,
# with no error anywhere — so every inbound reply (a lead replying to an
# HQ/system email) was accepted by Resend and then just discarded, forever,
# until someone happened to notice. That happened once already; this script
# is the fix: run it whenever you need live inbound mail in dev, and it
# re-syncs the webhook every single time, so it can't quietly go stale again.
#
# Usage:  ./scripts/dev-inbound-tunnel.sh
# Needs:  cloudflared installed (`brew install cloudflared`), and
#         RESEND_API_KEY + RESEND_WEBHOOK_ID in server/.env.
#
# For anything other than local dev, use a real named Cloudflare Tunnel (or
# a real inbound-parse provider) with a stable hostname instead — see
# PROD-READINESS.md.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="server/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found" >&2
  exit 1
fi

RESEND_API_KEY=$(grep -E '^RESEND_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)
WEBHOOK_ID=$(grep -E '^RESEND_INBOUND_WEBHOOK_ID=' "$ENV_FILE" | head -1 | cut -d= -f2-)

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "error: RESEND_API_KEY not set in $ENV_FILE" >&2
  exit 1
fi
if [ -z "${WEBHOOK_ID:-}" ]; then
  echo "error: RESEND_INBOUND_WEBHOOK_ID not set in $ENV_FILE" >&2
  echo "  Find it with: curl -s https://api.resend.com/webhooks -H \"Authorization: Bearer \$RESEND_API_KEY\"" >&2
  exit 1
fi

LOG=$(mktemp)
echo "Starting cloudflared tunnel to http://localhost:4000 ..."
cloudflared tunnel --url http://localhost:4000 > "$LOG" 2>&1 &
TUNNEL_PID=$!
trap 'kill "$TUNNEL_PID" 2>/dev/null' EXIT

# Wait for cloudflared to print its assigned URL (usually a few seconds).
URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "error: cloudflared never printed a tunnel URL — see $LOG" >&2
  exit 1
fi

ENDPOINT="$URL/api/emails/inbound/resend"
echo "Tunnel is up: $URL"
echo "Pointing Resend webhook $WEBHOOK_ID at $ENDPOINT ..."

RESP=$(curl -s -X PATCH "https://api.resend.com/webhooks/$WEBHOOK_ID" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"endpoint\":\"$ENDPOINT\",\"status\":\"enabled\"}")

if ! echo "$RESP" | grep -q '"object":"webhook"'; then
  echo "error: Resend didn't confirm the update: $RESP" >&2
  exit 1
fi

echo "Done — inbound mail is live. Leave this running; Ctrl+C stops the tunnel"
echo "(and Resend keeps pointing at a now-dead URL again until this is re-run)."
wait "$TUNNEL_PID"
