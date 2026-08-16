# Troubleshooting

Environment failures that look like application bugs. Each entry is written so
you can confirm the diagnosis in one command rather than guessing.

---

## `getaddrinfo ENOTFOUND` — the app cannot reach Supabase, but the internet works

### Symptom

Every database query fails at once. The dev server returns 500 and the log says:

```
Error: Failed query: select ... from "price_assets"
  [cause]: Error: getaddrinfo ENOTFOUND aws-1-us-east-2.pooler.supabase.com
```

The confusing part: `ping`, `nslookup`, the browser and `curl` all work fine on
the same machine, at the same moment. Nothing in the app changed.

### The short version

**The cause is iCloud Private Relay.**

Private Relay makes your Mac ask "where is this server?" through an Apple
tunnel instead of asking directly. When that tunnel re-establishes — which it
does periodically and on every network change — the questions travelling
inside it are lost. Terminal tools ask *outside* the tunnel, which is exactly
why `dig` and `nslookup` keep working while the app cannot resolve anything.

macOS then caches the failure as *"this name does not exist"*, so a few
seconds of tunnel churn becomes minutes of a broken app.

**The fix — turn it off for this network** (keeps it on everywhere else):

> System Settings → Wi-Fi → your network → Details… → **Limit IP Address
> Tracking = off**

Or globally: System Settings → Apple Account → iCloud → **Private Relay** off.

Then unstick the cached failure and restart the dev server:

```bash
sudo killall -HUP mDNSResponder
```

A second resolver is worth adding as a safety net either way, so a single
hiccup falls through instead of being cached as a failure:

```bash
networksetup -setdnsservers Wi-Fi 192.168.40.1 1.1.1.1 8.8.8.8
```

### The technical version

macOS has two independent paths to resolve a name, and they do not share state
— and Private Relay only sits on one of them:

| Path | Used by | Goes through |
| --- | --- | --- |
| `getaddrinfo(3)` | **Node, `postgres.js`, curl, every normal client** | `mDNSResponder` over Mach IPC |
| Direct DNS query | `dig`, `nslookup`, Node's `dns.resolve*` | UDP/53 straight to the nameserver |

`mDNSResponder` caches **negative** answers (NXDOMAIN / SERVFAIL), not just
positive ones. When the upstream resolver fails to answer, that failure is
cached and every subsequent `getaddrinfo` returns `ENOTFOUND` until the
negative TTL expires — while anything using the direct path against a
*different* server keeps resolving perfectly.

Node's driver uses `dns.lookup`, which is `getaddrinfo`. That is the entire
reason the app fails while your terminal looks healthy.

Private Relay proxies the `getaddrinfo` path through Apple's ingress/egress
relays. `dig` and `dns.resolve*` send UDP to port 53 themselves and never
touch it. So relay churn breaks the app and nothing else — the exact split
measured here every time.

### Evidence (2026-08-15)

Caught mid-failure by `scripts/diagnose-dns.sh`:

```
1. getaddrinfo (Node dns.lookup)   FAIL:ENOTFOUND
2. direct DNS (Node dns.resolve4)  FAIL:ESERVFAIL
3. upstream 192.168.40.1           FAIL:no-answer     ← the trigger
4. public 1.1.1.1                  3.131.201.192      ← same query, fine
5. TCP to 3.131.201.192            OK                 ← network is up
```

Under a minute later the same router answered **20/20** queries for that name
and 20/20 for an unrelated one, so the outage is intermittent and brief rather
than a misconfiguration.

That the cache is the amplifier, not just an artefact, is shown by an earlier
occurrence: `getaddrinfo` kept failing while `dns.resolve4`, `nslookup` and
`dscacheutil` all succeeded, **the bad state survived a dev-server restart**
(so it was system-level, not Node's), and it healed with no intervention —
a negative TTL expiring.

### Evidence it is Private Relay, and not this project

Measured 2026-08-15:

```
/usr/libexec/networkserviceproxy   running, 2h19m uptime
PrivacyProxyNetworkStatus          1  (active on this network)
utun4  (MTU 1380, relay tunnel)    917 KB in / 531 KB out — real traffic
scutil --nc list                   no VPN configured
ps | grep vpn|warp|tailscale|…     nothing
```

The app was ruled out directly. It fans out to ten external services on a
dashboard load, so "too many concurrent lookups" was the obvious suspect —
but firing 60 concurrent lookups across those same hosts produced **0/15**
subsequent failures. Query volume is not the trigger; relay re-establishment
is, which is why the failures are time-driven rather than load-driven and why
they heal on their own.

The project does *amplify* the annoyance: constant background revalidation
across ten services means more chances to be looking at the screen when the
relay blinks. It does not cause it.

### Why one fix is not enough

Flushing `mDNSResponder` clears the cached failure but does nothing about the
router dropping out again in ten minutes. This machine has **a single upstream
nameserver and no fallback**:

```
resolver #1
  nameserver[0] : 192.168.40.1     # the router — that's the whole list
```

With one resolver, every hiccup is a total outage *and* gets cached as one.
Adding a second means the lookup falls through to a server that works, so
nothing negative is ever cached:

```bash
networksetup -setdnsservers Wi-Fi 192.168.40.1 1.1.1.1 8.8.8.8
```

(Needs admin rights. `networksetup -getdnsservers Wi-Fi` shows the current
list; passing `Empty` restores the DHCP defaults.)

There are also eight `utun` interfaces active (VPN tunnels). VPN clients
rewrite resolver configuration as they connect and drop, which is a plausible
cause of the router-side hiccups worth ruling out if the fallback doesn't
settle it.

### Diagnose it

```bash
sh scripts/diagnose-dns.sh
```

It tests each layer separately — `getaddrinfo`, a direct query, your configured
upstream, a public resolver, and raw TCP — then prints which one is broken and
what to do. Pass a hostname to check something other than the Supabase pooler.

### After any fix, restart the dev server

Node keeps its own resolution cache for the life of the process, so a server
that has already failed keeps failing even once the system cache is clean.

### What NOT to do

Do not make the app paper over this — no custom DNS resolver in the Postgres
client, no retry-on-ENOTFOUND wrapper. `ENOTFOUND` from the database driver is
a true signal that name resolution is broken, and it means the same thing in
production. Hiding it locally would blind you to a real outage later.
