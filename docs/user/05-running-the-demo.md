# Running the demo locally

Two ways to start the app locally: the plain npm command, or the convenience scripts that also wait
for the server and can seed a second test org for you.

## Just the dev server

```bash
npm run dev
```

Open **http://localhost:3100**. The first request auto-seeds the **Meridian Recreation Club** demo org
with a fully-played tournament — see [`01-getting-started.md`](./01-getting-started.md#trying-it-locally-demo-data)
for its login table.

## Using `start` / `stop`

These wrap `npm run dev`, run it in the background, wait for the server to actually respond before
returning control, and optionally seed a **second** org — useful when you want to test multi-org
behavior (org switching, Super Admin cross-org access, an Org Admin's own onboarding) without
disturbing the Meridian demo data.

**macOS/Linux/Git Bash:**
```bash
./start.sh              # start the dev server only
./start.sh load-data    # ... + seed the org/users (1 Super Admin, 1 Org Admin, 36 players)
./start.sh vote         # ... + create the tournament, open the poll, have everyone vote
./stop.sh                # stop it
```

**Windows (cmd):**
```bat
start.bat
start.bat load-data
start.bat vote
stop.bat
```

The argument names a **stage** in SportCraft Club's tournament lifecycle — each call picks up from
wherever it last stopped and drives the real domain logic forward to that point, so the data stays
internally consistent (same engine the Meridian seed uses, just resumable):

| Stage | What it adds |
|---|---|
| `load-data` | The org + accounts only — no tournament yet (this is also the implicit first step of every later stage). |
| `vote` | Tournament created, poll opened, all 36 players signed up. |
| `poll-closed` | Poll closed. |
| `captains` | 6 captains picked, teams named. |
| `positions` | Remaining players categorized. |
| `auction` | Position auction run to completion — every roster filled. |
| `schedule` | Round-robin schedule generated, one match started live through the real point-by-point scoring path — log in as an Org Admin and keep adding points to it on the Live Scoring page. |
| `score` | A batch of the *other* matches filled in with results (so standings mean something), without touching the one already live. |
| `live` | Every remaining match played out, tournament in progress. |
| `playoffs` | Group stage finished, bracket generated. |

Calling a **later** stage than SportCraft Club has reached fast-forwards through everything in
between; calling the **same or an earlier** one than it's already at is a no-op — so `./start.sh live`
on a fresh server runs the whole pipeline in one shot, and running it again just reports back the
stage already reached.

Add `reset` (either order — `./start.sh vote reset` or `start.bat reset vote`) to drop SportCraft
Club's current tournament first and run that stage from scratch. Only the tournament (poll, teams,
positions, auction, matches, bracket) goes with it — the org and its 38 accounts stay put.

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@sportcraftclub.local` | `sportcraft2026` |
| Org Admin | `orgadmin@sportcraftclub.local` | `sportcraft2026` |
| Player (36 seeded accounts) | see `/app/sportcraft-club/admin/users` as the Org Admin for the full roster | `sportcraft2026` |

> Both the scripts and the seed route are **local-dev only** (guarded by `NODE_ENV !== "production"`,
> same as the Meridian seed in `src/lib/seed.ts`) — neither ships any behavior reachable in production.
