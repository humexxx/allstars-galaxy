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

Your Mac keeps a little notebook of "what address does this name have?". If a
lookup fails once — a Wi-Fi blip, a VPN flapping, the router taking too long —
macOS writes down **"this name doesn't exist"** and keeps repeating that answer
for a while instead of asking again.

Tools like `nslookup` and `dig` ignore the notebook and ask the DNS server
directly, so they work. Your app doesn't ignore it, so it keeps getting the
wrong answer. Tearing the page out of the notebook fixes it instantly:

```bash
sudo killall -HUP mDNSResponder
```

### The technical version

macOS has two independent paths to resolve a name, and they do not share state:

| Path | Used by | Goes through |
| --- | --- | --- |
| `getaddrinfo(3)` | **Node, `postgres.js`, curl, every normal client** | `mDNSResponder` over Mach IPC |
| Direct DNS query | `dig`, `nslookup`, Node's `dns.resolve*` | UDP/53 straight to the nameserver |

`mDNSResponder` caches **negative** answers (NXDOMAIN / SERVFAIL), not just
positive ones. When a query fails transiently, that failure is cached and every
subsequent `getaddrinfo` for the same name returns `ENOTFOUND` until the
negative TTL expires — while anything using the direct path keeps resolving
perfectly, because it never consults that cache.

Node's driver uses `dns.lookup`, which is `getaddrinfo`. That is the entire
reason the app fails while your terminal looks healthy.

### Evidence this is what happened here (2026-08-15)

Measured at the same instant, against `aws-1-us-east-2.pooler.supabase.com`:

```
dns.lookup   (getaddrinfo)  -> ENOTFOUND
dns.resolve4 (direct query) -> 13.58.13.125      ✅
nslookup                    -> 3.131.201.192     ✅
dscacheutil -q host         -> 3 addresses       ✅
```

Two further observations pin it down:

- **Restarting the dev server did not fix it.** The bad state outlived the
  process, so it is system-level, not a Node-side cache.
- **It healed on its own** some minutes later with no intervention — exactly how
  a cached negative answer behaves once its TTL runs out.

Ruled out: the upstream nameserver (25/25 queries answered, 0 failures) and the
network (TCP to the resolved IP succeeded throughout).

### Diagnose it

```bash
sh scripts/diagnose-dns.sh
```

It tests each layer separately — `getaddrinfo`, a direct query, your configured
upstream, a public resolver, and raw TCP — then prints which one is broken and
what to do. Pass a hostname to check something other than the Supabase pooler.

### Fix it

```bash
sudo killall -HUP mDNSResponder
```

**Then restart the dev server.** Node keeps its own resolution cache for the
life of the process, so a server that has already failed will keep failing even
after the system cache is clean.

### Why it keeps coming back

This machine has **a single upstream nameserver and no fallback**:

```
resolver #1
  nameserver[0] : 192.168.40.1     # the router — that's the whole list
```

With one resolver, any hiccup is a total outage and gets cached as one. There
are also eight `utun` interfaces active (VPN tunnels), and VPN clients rewrite
resolver configuration as they connect and drop, which is a common trigger for
exactly this failure.

Adding a second resolver so a single hiccup is retried elsewhere rather than
cached as "does not exist":

```bash
networksetup -setdnsservers Wi-Fi 192.168.40.1 1.1.1.1 8.8.8.8
```

(That command needs admin rights and changes system network settings — run it
yourself if you want the change. `networksetup -getdnsservers Wi-Fi` shows the
current list, and passing `Empty` restores DHCP defaults.)

### What NOT to do

Do not make the app paper over this — no custom DNS resolver in the Postgres
client, no retry-on-ENOTFOUND wrapper. `ENOTFOUND` from the database driver is
a true signal that name resolution is broken, and it means the same thing in
production. Hiding it locally would blind you to a real outage later.
