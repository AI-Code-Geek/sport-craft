# SportCraft

Multi-sport, multi-organization community league platform — poll signup, captain draft, position-based
live auction, round-robin scheduling, live set-by-set scoring, standings, and a playoff bracket. One
deployment hosts many independent organizations, each running its own tournament(s).

Next.js (App Router) on Cloudflare Workers via OpenNext — **no database, everything lives in a single
Cloudflare KV namespace.** See [`docs/developer/01-architecture.md`](docs/developer/01-architecture.md)
for the full picture.

## Roles & approval flow

Three roles: **Super Admin** (platform-level, manually provisioned only — no self-service path
exists), **Org Admin** (runs one org day-to-day: creates/runs its tournaments, manages its members),
and **Player** (the default role for anyone who joins an org).

- **Creating an org** is a request/approval flow: anyone submits a "Request an org" form (name, sport,
  which features to enable) from the login page; it sits `pending` until a Super Admin approves it. On
  approval the requester becomes that org's founding Org Admin.
- **Joining an org** (via its invite code) is also request/approval, but reviewed by *that org's* Org
  Admin instead — an account can hold active/pending memberships in multiple orgs at once, each with
  its own role, and switches between them with the org picker in the nav.
- **Features** (poll, scheduler, team creation, positions, auction, live scoring, brackets,
  notifications) are chosen per org at request time and can be toggled later from Org Settings —
  disabling one hides it from the nav and admin console for that org.

Full detail: [`docs/developer/03-auth-and-roles.md`](docs/developer/03-auth-and-roles.md).

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3100 (NOT 3000 — see docs/developer/04-local-development.md)
```

The first request lazily seeds one demo organization ("Meridian Recreation Club") with a fully-played
tournament, so every screen has real data immediately. Log in with the seeded Super Admin account
(shown right on the login form):

```
admin@sportcraft.demo / sportcraft2026
```

Every other demo account uses the same password. Full seeded-account table and a step-by-step
walkthrough of the live poll → captains → positions → auction flow:
[`docs/user/01-getting-started.md`](docs/user/01-getting-started.md).

## Documentation

| | |
|---|---|
| [`docs/developer/`](docs/developer/) | Architecture, data model, auth/roles, local dev, deployment, API reference — for anyone changing this code. |
| [`docs/user/`](docs/user/) | Getting started, Player guide, Org Admin guide, Super Admin guide — for anyone *using* the app. |
| [`docs/DEVPLAN.md`](docs/DEVPLAN.md) | The original pre-build plan. Historical — superseded by `docs/developer/`, kept for context on why things are shaped the way they are. |

## Deploying to Cloudflare

Production deploys run through an automated pipeline (Cloudflare Workers Builds) — push to the
connected branch and it builds/deploys on its own. One-time setup (KV namespace, session secret,
provisioning the first Super Admin) and the manual/local deploy path:
[`docs/developer/05-deployment.md`](docs/developer/05-deployment.md).
