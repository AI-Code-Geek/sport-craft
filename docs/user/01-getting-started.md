# Getting started

SportCraft hosts many independent **organizations** ("orgs") — each one runs its own league or
tournament. You either **join an existing org** or **request a new one**; either way starts from the
login page.

## Roles, in one paragraph

**Super Admin** approves new org requests (platform-level, not tied to any one org). **Org Admin** runs
one org day-to-day — creates its tournaments, runs the poll/auction/schedule/scoring, and approves who
gets to join. **Player** is what everyone else is by default. One account can belong to several orgs at
once, with a different role in each — switch between them with the org picker in the nav (only shows
up once you're actually in more than one).

## Joining an existing org

1. Get that org's **invite code** from its Org Admin.
2. On the login page, open the **"Join a community"** tab.
3. Enter your name, email, password, and the invite code, then submit.
4. Your request lands as a **pending "player" membership** — it's not active until that org's Org
   Admin approves it. If your email already has an account elsewhere on the platform, this just adds
   the new org to it — one login, no new password to remember.
5. While pending, logging in shows an **"Awaiting approval"** screen instead of the app — nothing to do
   but wait for the Org Admin.

## Requesting a brand-new org

1. On the login page, open the **"Request an org"** tab.
2. Give it a name, pick a sport, choose which features it needs (poll, scheduler, teams, positions,
   auction, live scoring, brackets, notifications), and your own name/email/password.
3. Submit. This sits **pending** until a platform Super Admin reviews it — there's no way to skip that
   review.
4. If approved, you become that org's **founding Org Admin** automatically — log in with the email and
   password you just gave.
5. If rejected, nothing was created; you're free to submit again.

## Trying it locally (demo data)

Running the app locally (`npm run dev`) seeds one demo org automatically on first load, so you don't
need to go through either flow above just to look around:

| Role | Name | Email | Password |
|---|---|---|---|
| Super Admin + Org Admin | Jordan Ellis | `admin@sportcraft.demo` | `sportcraft2026` |
| Org Admin | David Kim | `david.kim@sportcraft.demo` | `sportcraft2026` |
| Org Admin | Priya Nair | `priya.nair@sportcraft.demo` | `sportcraft2026` |
| Player (any other seeded account) | — | see `/app/admin/users` as an Org Admin for the full roster | `sportcraft2026` |

The seeded tournament is already fully played through (poll closed, auction complete, several matches
scored, one live). See [`02-player-guide.md`](./02-player-guide.md) and
[`03-org-admin-guide.md`](./03-org-admin-guide.md) for what to do once you're in — and
[`04-super-admin-guide.md`](./04-super-admin-guide.md) if you're reviewing org requests.

> This demo data **only exists locally** — a production deploy never auto-seeds anything; every org
> there comes from the real join/request flow above.
