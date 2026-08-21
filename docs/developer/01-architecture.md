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

## Request flow

```
Browser
  │  fetch("/api/...", { credentials: "include" })
  ▼
middleware.ts  ── verifies session cookie signature+expiry (no KV read)
  │                also blocks cross-origin POST/PATCH (CSRF check)
  ▼
Route handler (src/app/api/**/route.ts)
  │  readSession() → Session { userid, isSuperAdmin, communityId, role, exp }
  │  authz check (isSuperAdmin / isOrgAdminOf / canManageTournament)
  ▼
Domain store (src/lib/*-store.ts) ── kvGetJSON / kvPutJSON
  ▼
Cloudflare KV (real, disk-persisted Miniflare KV even under plain `next dev` — see 04-local-development.md)
```

Client components never talk to KV directly — every read/write goes through a typed wrapper in
`src/lib/api-client.ts`, which calls the route handlers above.

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
