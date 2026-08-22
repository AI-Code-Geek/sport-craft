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
./start.sh              # start the dev server
./start.sh load-data     # start the dev server, then seed "SportCraft Club"
./stop.sh                # stop it
```

**Windows (cmd):**
```bat
start.bat
start.bat load-data
stop.bat
```

`load-data` calls a dev-only API route that creates one Super Admin, one Org Admin, and 36 players —
all under a brand-new org called **SportCraft Club**, with every account using the same password.
Running it again is safe — it's a no-op if SportCraft Club already exists.

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@sportcraftclub.local` | `sportcraft2026` |
| Org Admin | `orgadmin@sportcraftclub.local` | `sportcraft2026` |
| Player (36 seeded accounts) | see `/app/sportcraft-club/admin/users` as the Org Admin for the full roster | `sportcraft2026` |

SportCraft Club starts completely empty (no tournament yet) — log in as either admin and create one
from scratch to walk through the poll → captains → positions → auction → schedule → scoring lifecycle
yourself, instead of looking at Meridian's already-finished one.

> Both the scripts and the seed route are **local-dev only** (guarded by `NODE_ENV !== "production"`,
> same as the Meridian seed in `src/lib/seed.ts`) — neither ships any behavior reachable in production.
