#!/usr/bin/env sh
#
# Pinpoint which layer of DNS is broken when the app suddenly cannot reach
# Supabase and the error is `getaddrinfo ENOTFOUND`.
#
# The whole point is to distinguish four failures that look identical from the
# app but have completely different fixes:
#
#   1. The system resolver (getaddrinfo / mDNSResponder) — the common one
#   2. The configured upstream DNS server
#   3. The network itself
#   4. A sandboxed process denied the Mach lookup to mDNSResponder
#
# Usage:  sh scripts/diagnose-dns.sh [hostname]
#
# See docs/TROUBLESHOOTING.md for what to do with each verdict.

HOST="${1:-aws-1-us-east-2.pooler.supabase.com}"

echo "Diagnosing DNS for: $HOST"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo

# ── 1. getaddrinfo: what Node, postgres.js and every normal client use ───────
# This is the layer that actually breaks. It goes through mDNSResponder over
# Mach IPC, NOT over the network, which is why it can fail while every other
# tool on this list works.
GAI=$(node -e '
const dns = require("dns");
dns.lookup(process.argv[1], (e, a) => {
  console.log(e ? "FAIL:" + e.code : "OK:" + a);
  process.exit(e ? 1 : 0);
});
' "$HOST" 2>/dev/null) || GAI="${GAI:-FAIL:node-missing}"
echo "1. getaddrinfo (Node dns.lookup)   $GAI"

# ── 2. Direct DNS query, bypassing the system resolver and its cache ─────────
DIRECT=$(node -e '
const dns = require("dns");
dns.resolve4(process.argv[1], (e, a) => {
  console.log(e ? "FAIL:" + e.code : "OK:" + a[0]);
  process.exit(e ? 1 : 0);
});
' "$HOST" 2>/dev/null) || DIRECT="${DIRECT:-FAIL:node-missing}"
echo "2. direct DNS (Node dns.resolve4)  $DIRECT"

# ── 3. The configured upstream, queried straight ─────────────────────────────
NS=$(scutil --dns 2>/dev/null | awk '/nameserver\[0\]/ {print $3; exit}')
NS="${NS:-192.168.1.1}"
UP=$(dig +time=2 +tries=1 +short "$HOST" "@$NS" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
echo "3. upstream $NS            ${UP:-FAIL:no-answer}"

# ── 4. A public resolver, to separate "your DNS" from "the internet" ─────────
PUB=$(dig +time=2 +tries=1 +short "$HOST" @1.1.1.1 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
echo "4. public 1.1.1.1                  ${PUB:-FAIL:no-answer}"

# ── 5. Raw connectivity, no DNS involved at all ──────────────────────────────
IP="${PUB:-$UP}"
if [ -n "$IP" ]; then
  if nc -z -G 3 "$IP" 443 2>/dev/null || nc -z -G 3 "$IP" 5432 2>/dev/null; then
    echo "5. TCP to $IP                 OK"
  else
    echo "5. TCP to $IP                 FAIL:unreachable"
  fi
else
  echo "5. TCP                             SKIPPED (no IP resolved)"
fi

echo
echo "── Verdict ──────────────────────────────────────────────────────────────"

case "$GAI" in
  OK:*)
    echo "DNS is healthy right now. If the app is still failing, the process"
    echo "holding the bad state has not been restarted — restart the dev server."
    ;;
  *)
    # Order matters. Test the upstream FIRST: when the configured resolver is
    # the thing that failed, the negative answer cached by mDNSResponder is a
    # consequence, and flushing it just buys a few seconds until the next
    # hiccup poisons it again.
    if [ -z "$UP" ] && [ -n "$PUB" ]; then
      echo "YOUR CONFIGURED DNS SERVER IS FAILING — $NS did not answer,"
      echo "while 1.1.1.1 answered the same query fine."
      echo
      echo "These outages are brief (tens of seconds) but macOS caches the"
      echo "failure as \"this name does not exist\", so the app stays broken"
      echo "long after the resolver recovers."
      echo
      echo "Unstick it now (needs your password):"
      echo
      echo "    sudo killall -HUP mDNSResponder"
      echo
      echo "Stop it recurring by adding a fallback resolver, so a hiccup falls"
      echo "through to one that works instead of being cached as a failure:"
      echo
      echo "    networksetup -setdnsservers Wi-Fi $NS 1.1.1.1 8.8.8.8"
      echo
      echo "Then RESTART the dev server — Node caches resolutions per process."
    elif [ -n "$UP" ] || [ -n "$PUB" ]; then
      echo "THE SYSTEM RESOLVER IS WEDGED."
      echo
      echo "DNS servers answer, but getaddrinfo does not — mDNSResponder is"
      echo "serving a stale negative answer. Flush it (needs your password):"
      echo
      echo "    sudo killall -HUP mDNSResponder"
      echo
      echo "Then RESTART the dev server — Node processes cache resolutions and"
      echo "will keep failing until they do."
    else
      echo "DNS IS DOWN EVERYWHERE — no resolver answered, public ones included."
      echo "Check Wi-Fi, then whether a VPN has taken over DNS:"
      echo "    scutil --dns | head -20"
      echo "    ifconfig | grep '^utun'"
    fi
    ;;
esac
