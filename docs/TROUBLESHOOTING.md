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

Two things go wrong together, and only fixing one of them is why this keeps
coming back.

**The trigger:** your router's DNS service drops out for short windows — tens
of seconds at a time. During one, nothing can look up anything through it.

**The amplifier:** when a lookup fails, macOS writes down *"this name does not
exist"* and keeps repeating that answer well after the router has recovered.
So a 30-second router hiccup turns into minutes of a broken app.

Tools like `dig` and `nslookup` ask a DNS server directly and skip that
notebook, which is why they work while your app does not.

Unstick it now:

```bash
sudo killall -HUP mDNSResponder
```

Stop it happening again, by giving the Mac a second DNS server to fall through
to instead of caching a failure:

```bash
networksetup -setdnsservers Wi-Fi 192.168.40.1 1.1.1.1 8.8.8.8
```

### The technical version

macOS has two independent paths to resolve a name, and they do not share state:

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
