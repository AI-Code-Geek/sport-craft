# Architecture

## Stack

- **Next.js (App Router)**, deployed to **Cloudflare Workers** via **OpenNext** (`@opennextjs/cloudflare`).
- **No database.** Every domain (organizations, users, tournaments, polls, teams, positions, auctions,
  matches, brackets, notifications) is stored as JSON blobs in a **single Cloudflare KV namespace**.
  See [`02-data-model.md`](./02-data-model.md) for the full key layout.
- **No WebSockets / Durable Objects.** Live views (auction board, live scoreboard) re-fetch on a short
  poll interval instead. Simple, free-tier-friendly, and fast enough for a rec-league crowd.
- Session auth is a **signed httpOnly cookie** (HMAC-SHA256, Web Crypto only — runs identically in
  Next's Edge middleware and in the Worker). See [`03-auth-and-roles.md`](./03-auth-and-roles.md).

## System diagram

```
                                   ┌─────────────────────────────┐
                                   │           Browser            │
                                   │                               │
                                   │  landing page (login / join /  │
                                   │  request-org)                  │
                                   │  participant pages (poll,      │
                                   │  teams, auction, schedule, ...) │
                                   │  admin console (Org Admin /     │
                                   │  Super Admin)                  │
                                   └───────────────┬───────────────┘
                                                    │  fetch(), credentials: "include"
                                                    │  signed httpOnly session cookie
                                                    ▼
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                     Cloudflare Workers  (Next.js via OpenNext)                      ║
║                                                                                       ║
║   ┌─────────────────────────────────────────────────────────────────────────────┐   ║
║   │  middleware.ts  (Edge)                                                       │   ║
║   │    • verify session cookie signature + expiry   — NO KV read                │   ║
║   │    • block cross-origin POST/PATCH (CSRF)                                   │   ║
║   │    • /api/auth/* and POST /api/organizations/requests stay public           │   ║
║   └───────────────────────────────────┬─────────────────────────────────────────┘   ║
║                                       ▼                                              ║
║   ┌─────────────────────────────────────────────────────────────────────────────┐   ║
║   │  Route handlers   src/app/api/**/route.ts   (the only thing that touches KV) │   ║
║   │    readSession() → { userid, isSuperAdmin, communityId, role, exp }          │   ║
║   │    authz check    → isSuperAdmin / isOrgAdminOf / canManageTournament        │   ║
║   └───────────────────────────────────┬─────────────────────────────────────────┘   ║
║                                       ▼                                              ║
║   ┌─────────────────────────────────────────────────────────────────────────────┐   ║
║   │  Domain stores   src/lib/*-store.ts   (one file per entity)                 │   ║
║   │    user-store · community-store · org-request-store · tournament-store     │   ║
║   │    poll-store · team-store · position-store · auction-store · match-store   │   ║
║   │    bracket-store · notification-store · standings.ts (pure fn, no store)    │   ║
║   └───────────────────────────────────┬─────────────────────────────────────────┘   ║
╚═══════════════════════════════════════╪═════════════════════════════════════════════╝
                                        │  kvGetJSON / kvPutJSON (JSON blobs)
                                        ▼
                     ┌─────────────────────────────────────────────┐
                     │   Cloudflare KV  — ONE namespace, no DB      │
                     │   (real + disk-persisted even under          │
                     │    plain `next dev` — see 04, initOpenNext-   │
                     │    CloudflareForDev())                        │
                     │                                                │
                     │   user:<id>          community:<id>            │
                     │   idx:email:<email>  org-request:<id>          │
                     │   tournament:<id>    poll:<tid> teams:<tid>     │
                     │   positions:<tid>    auction:<tid>              │
                     │   matches:<tid>      bracket:<tid>              │
                     │   notifications:<tid>  rl:<bucket>:<id>         │
                     └────────────────────────────────────────────────┘
```

Client components never talk to KV directly — every read/write goes through a typed wrapper in
`src/lib/api-client.ts`, which calls the route handlers above. Full key list:
[`02-data-model.md`](./02-data-model.md).

## Multi-tenant shape, at a glance

One deployment, one KV namespace, many independent orgs — every tournament/poll/roster key is scoped
by `communityId`/`tournamentId`, so orgs never see each other's data even though they share storage:

```
Cloudflare KV (shared)
 ├─ community:org-A ── tournament:t1 ── poll / teams / positions / auction / matches / bracket
 │                  └─ tournament:t2 ── (a second, independent tournament for the same org)
 ├─ community:org-B ── tournament:t3 ── poll / teams / positions / auction / matches / bracket
 └─ community:org-C ── (no tournament yet — just created, no /app/* data until one exists)

 user:u1 ── memberships: [ {org-A, org_admin, active}, {org-B, player, pending} ]
 user:u2 ── memberships: [ {org-B, org_admin, active} ]
                                (one account, many orgs, a different role in each)
```

## Why no database

The original plan (see the historical `docs/DEVPLAN.md`) assumed D1 (SQLite) for the relational bits
(rosters, matches, sets, standings). The shipped implementation instead keeps everything in KV:
- Every entity that matters is small (a tournament's poll, roster, or match list is at most a few
  hundred rows) — cheap to read/write as one JSON blob per entity.
- Standings are **computed on read** from the match list (`src/lib/standings.ts`), never persisted —
  no derived-cache drift to worry about.
- One less moving part to provision/migrate for a project this size.

## Multi-tenancy model

SportCraft hosts many **organizations** ("orgs" — the `Community` type, named for historical reasons)
on one deployment, each independently running its own tournament(s). An org:
- picks a **sport** (only volleyball has a fully wired rules engine today — see `SportType` in
  `src/lib/types.ts`),
- picks which **features** it wants (poll, scheduler, teams, positions, auction, live scoring,
  brackets, notifications — see `FeatureKey`), which gates what shows up in its nav and admin console,
- has its own **invite code** for players to join, and its own **Org Admin(s)** who run it.

One user account can hold **memberships in multiple orgs** at once (each with its own role), and
switches between them with the org picker in the nav. See
[`03-auth-and-roles.md`](./03-auth-and-roles.md) for the full role/approval model.

## Directory map

```
src/
  app/
    page.tsx                 landing page (login / join-org / request-org tabs)
    layout.tsx                root layout, fonts, theme bootstrap script
    app/                      the signed-in app shell ("/app/**")
      page.tsx                home (tournament status + "your next action")
      poll/ teams/ auction/ schedule/ standings/ bracket/ profile/  participant pages
      admin/                  Org Admin / Super Admin console ("/app/admin/**")
        organizations/         Super Admin: org-request queue + org list
        settings/               org identity, sport, features, invite code
        users/                  member list, roles, suspensions, pending join requests
        tournaments/new/ tournament/ poll/ captains/ positions/ auction/
        schedule/ scoring/ playoffs/   one page per lifecycle stage
    api/                      route handlers (BFF) backing every page above
  components/                 Nav, shared UI primitives (Card, StatusBadge, LifecycleStepper, ...)
  lib/                        domain stores (one *-store.ts per entity), auth, session, kv, api-client
docs/
  DEVPLAN.md                  historical pre-build plan (superseded by docs/developer/**)
  developer/                  this folder
  user/                       end-user guides, by role
mockups/                      static HTML UX prototypes (pre-dates the real build; reference only)
```

## Next in this series
- [`02-data-model.md`](./02-data-model.md) — every type + KV key
- [`03-auth-and-roles.md`](./03-auth-and-roles.md) — sessions, roles, approval flows
- [`04-local-development.md`](./04-local-development.md) — running this locally
- [`05-deployment.md`](./05-deployment.md) — shipping to Cloudflare
- [`06-api-reference.md`](./06-api-reference.md) — every route, who can call it
