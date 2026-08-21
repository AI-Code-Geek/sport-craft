# Running locally (developer guide)

## Prerequisites

- **Node.js 20+** and npm.
- **No Cloudflare account needed to start.** `next.config.ts` calls `initOpenNextCloudflareForDev()`,
  which gives plain `next dev` a real, disk-persisted local KV store automatically (via Miniflare) —
  nothing to sign up for or provision just to run the app.

## First-time setup

```bash
git clone <this repo>
cd volleballTournament        # or wherever you cloned it
npm install
```

Create `.env.local` in the project root with the one required variable:

```
SECRET="anything-long-and-random-for-local-dev"
```

This signs session cookies. Without it, login/registration fail closed (no default/fallback exists by
design — see [`03-auth-and-roles.md`](./03-auth-and-roles.md)).

## Run it

```bash
npm run dev
```

Open **http://localhost:3100** (pinned off 3000 in `package.json`'s `dev` script, since 3000 is
commonly already taken by another local project — edit the script if you need a different port).

The **first request** lazily seeds one demo organization with a fully-played tournament, so every
screen has real data immediately — no manual fixture setup. Seeded accounts and a full click-through
walkthrough are in [`docs/user/01-getting-started.md`](../user/01-getting-started.md).

> **Seeding only runs when `NODE_ENV !== "production"`** (`src/lib/seed.ts`). A production deploy never
> auto-creates any data — every org there comes from the real request/approval flow.

## Day-to-day workflow

```bash
npm run dev            # keep this running; Next.js hot-reloads on file save
npx tsc --noEmit        # fast typecheck while iterating — no build output, catches most mistakes
npm run build           # full production build before you consider something done
```

Local KV is **real and disk-persisted** under `.wrangler/state/` — it survives `npm run dev` restarts
and behaves the same way production KV would (writes are real writes, not an in-memory illusion that
resets on refresh).

**Reset to a clean seed:**
```bash
# stop the dev server first
rm -rf .wrangler/state
npm run dev        # re-seeds on the next request
```

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (port 3100). |
| `npx tsc --noEmit` | Typecheck only, no build output — fast, run this first when debugging a type error. |
| `npm run build` | Production Next.js build — this is also what the Cloudflare pipeline runs (see [`05-deployment.md`](./05-deployment.md)). |
| `npm run check` | `next build && tsc` — the full local pre-push check. |
| `npm run cf-typegen` | Regenerate `env.d.ts` after editing `wrangler.jsonc`'s bindings/vars. |
| `npm run preview` | Build + run the actual OpenNext-built Worker locally — the closest thing to a production dry run you can do offline. |
| `npm run deploy` | Manual build + deploy to Cloudflare Workers. Normally unnecessary — see [`05-deployment.md`](./05-deployment.md) for the automated pipeline that runs this on every push. |

## Troubleshooting

**`EBADPLATFORM` / `Unsupported platform for @tailwindcss/oxide-win32-x64-msvc` (or `lightningcss-*`)
during `npm install` or `npm ci` on a non-Windows machine (e.g. Cloudflare's Linux build environment):**
these are Tailwind/lightningcss's per-platform native binaries. They must **never** appear as a direct
entry in `package.json`'s `dependencies` — they're supposed to resolve automatically as
`optionalDependencies` of `@tailwindcss/oxide`/`lightningcss` themselves, picking whichever platform
variant matches wherever `npm install` actually runs. If you see this, check
`package.json`'s `dependencies` for a stray `*-win32-*`/`*-darwin-*`/`*-linux-*` package and delete it,
then run `npm install` locally to regenerate `package-lock.json` and commit both files.

**Port 3100 already in use:** something else (often a previous `next dev` that didn't exit cleanly) is
still listening. Find and stop it, or change the port in `package.json`'s `dev` script.

**Login/registration returns `server_misconfigured`:** `SECRET` isn't set — check `.env.local` exists
and the dev server was restarted after adding it (env files are only read at server start).

**Seeded data looks stale/wrong after pulling new code:** the seed only ever runs once per KV store
(`idx:seeded:v1` marker). Run `rm -rf .wrangler/state` and restart to force a fresh seed.

## A note on `eslint`

`next lint` / `eslint` is currently broken in this project (a config-loading crash unrelated to any
app code — `TypeError: Converting circular structure to JSON` from `@eslint/eslintrc` resolving the
`react` plugin). `npx tsc --noEmit` and `npm run build` are the reliable correctness checks until that
dependency issue is sorted out; don't treat `npm run lint` passing or failing as a signal either way.
