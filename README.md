# Estancia Volleyball League

Community volleyball tournament manager — poll signup, captain draft, position-based live auction,
round-robin scheduling, live set-by-set scoring, standings, and a playoff bracket. Next.js on
Cloudflare Workers (OpenNext), **no database — everything lives in a single Cloudflare KV
namespace** (see `docs/DEVPLAN.md` §3 for the key layout).

## Roles & approval flow

Three roles: **Super Admin** (platform-level, seeded only — no self-service path exists), **Org
Admin** (runs one org day-to-day: creates/runs its tournaments, manages its members), and **Player**
(the default role for anyone who registers).

- **Creating an org** is a request/approval flow: anyone submits a "Request an org" form (name, sport,
  which features to enable) from the login page; it sits `pending` until a Super Admin approves it. On
  approval the requester becomes that org's founding Org Admin.
- **Joining an org** (via its invite code) is also request/approval, but reviewed by *that org's* Org
  Admin instead — an account can hold active/pending memberships in multiple orgs at once, each with
  its own role, and switches between them with the org picker in the nav.
- **Features** (poll, scheduler, team creation, positions, auction, live scoring, brackets,
  notifications) are chosen per org at request time and can be toggled later from Org Settings —
  disabling one hides it from the nav and admin console for that org.

## Run it locally

```bash
npm install
npm run dev      # starts on http://localhost:3100 (NOT 3000 — see note below)
```

Open **http://localhost:3100** and log in with the seeded Super Admin account (shown right on the
login form):

```
meera.success@gmail.com / volleyball2026
```

Every other demo account below uses the **same password**: `volleyball2026`.

> **Port 3000:** the dev script is pinned to `-p 3100` because port 3000 is commonly already taken
> by another local project. If you need a different port, edit the `dev` script in `package.json`.

### What's pre-seeded

The first request lazily seeds one demo community ("Estancia Recreation Club") with a fully-played
tournament ("Estancia Summer Volleyball League 2026" — poll closed, captains picked, auction
complete, 15-match round-robin schedule with 9 matches completed, 1 live, 5 upcoming) so every
screen has real data to look at immediately. Seeding happens **through the real engine** (poll
join/confirm logic, the auction bid/resolve engine, the schedule generator), not hand-typed fixture
data — the only shortcut is that match *results* are written directly rather than played out
point-by-point, purely for seed speed.

Local KV is a **real, disk-persisted** Miniflare KV store under `.wrangler/state/` (not an
in-memory mock) — state survives `npm run dev` restarts, same as it would in production. To reset
to a clean seed, stop the dev server and delete that folder:

```bash
rm -rf .wrangler/state
```

### Demo accounts (all password `volleyball2026`)

| Role | Name | Email |
|---|---|---|
| Super Admin + Org Admin | Meera Iyer | `meera.success@gmail.com` |
| Org Admin | David Kim | `david.kim@estancia.demo` |
| Org Admin | Priya Nair | `priya.nair@estancia.demo` |
| Captain — Estancia Smashers | Meera Santos | `meera.santos1@estancia.demo` |
| Captain — Net Ninjas | Riley Wallace | `riley.wallace8@estancia.demo` |
| Captain — Sunset Spikers | Reese Kim | `reese.kim15@estancia.demo` |
| Captain — Block Party | David Bianchi | `david.bianchi22@estancia.demo` |
| Captain — Ace Avengers | Chris Petrov | `chris.petrov29@estancia.demo` |
| Captain — Rally Rebels | Cameron Costa | `cameron.costa36@estancia.demo` |
| Player (confirmed, no team role) | — | any other `@estancia.demo` address; see `/app/admin/users` (Super Admin) for the full roster of 42 seeded players |

Each community's **invite code** (needed on the "Join a community" tab to register a brand-new
account) is generated per-seed — look it up as Super Admin, or just log in with one of the accounts
above instead of registering.

### Trying the full lifecycle yourself

The seeded tournament is already fully played through, so to watch the **poll → captains →
positions → auction** flow happen live (rather than pre-seeded), create a second tournament as
Super Admin at `/app/admin/tournaments/new` — creating a new tournament makes it the community's
"active" one, so `/app/*` immediately reflects it. Then, as Super Admin/Organizer:

1. `/app/admin/poll` → **Open poll** → have a few of the demo accounts log in and join at
   `/app/poll`, or (faster) act on their behalf: `POST /api/tournaments/<id>/poll/vote
   {"action":"join","userId":"<their id>"}` while signed in as Super Admin/Organizer.
2. `/app/admin/captains` → pick 6 captains from the confirmed pool, name the teams.
3. `/app/admin/positions` → confirmed non-captain players auto-round-robin into the 5 position
   buckets as a starting point; reassign as needed until every bucket reads `N/6 · full`, then
   **Start auction**.
4. `/app/admin/auction` (control) and `/app/auction` (captain bid view / spectator view) — log in as
   one of the captain accounts above in a second browser/incognito window to place real bids; the
   organizer view can **Mark sold** or **Force-resolve** to advance.
5. `/app/admin/schedule` → generate the round robin; `/app/admin/scoring` → enter live points;
   `/app/admin/playoffs` → once the group stage is done, generate the bracket.

## Deploying to Cloudflare

```bash
npm run cf-typegen     # regenerate env.d.ts from wrangler.jsonc (needs a real KV namespace id first)
wrangler kv namespace create estancia-volleyball-kv   # then paste the id into wrangler.jsonc
wrangler secret put SECRET                            # session-cookie signing key
npm run deploy          # opennextjs-cloudflare build && deploy
```

See `docs/DEVPLAN.md` for the full architecture, data model, and phased build plan.
