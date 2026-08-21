# Deployment (Cloudflare Workers)

Deployed via **OpenNext's Cloudflare adapter** on top of **Cloudflare Workers Builds** — a Git-connected
CI/CD pipeline, not a manual push from a laptop. Once set up, **a normal `git push` to the connected
branch is the entire deploy process**: Cloudflare pulls the repo, runs `npm clean-install`, builds, and
deploys automatically. There's no separate "click deploy" step for day-to-day changes.

```
git push origin main
        │
        ▼
Cloudflare Workers Builds (hosted CI, not your machine)
   1. Restore dependency/build caches
   2. npm clean-install                 ← must succeed with NO local-machine assumptions
   3. next build (via the OpenNext adapter)
   4. Deploy the built Worker
```

This matters for one thing above all: **the CI environment is Linux, not whatever OS a developer's
laptop runs.** `npm clean-install` (`npm ci`) installs *exactly* what `package.json`/`package-lock.json`
say, with no tolerance for drift — so a dependency that only makes sense on one OS (see the
Troubleshooting note in [`04-local-development.md`](./04-local-development.md) about platform-specific
native packages like `@tailwindcss/oxide-win32-x64-msvc`) will hard-fail the pipeline with
`npm error code EBADPLATFORM` even though `npm install` might look fine on a Windows dev machine. If a
deploy fails at the "Installing project dependencies" step, that's the first thing to check.

## Where the pipeline is configured

Cloudflare dashboard → **Workers & Pages → (this Worker) → Settings → Build** — this is where the
connected repo, the branch that triggers a production deploy, the build command, and any
environment-variable/secret bindings for the *build itself* (distinct from the Worker's own runtime
`vars`/secrets in `wrangler.jsonc` — see below) are configured. Nothing about that configuration lives
in this repo; check the dashboard if you need to know exactly which branch deploys where.

## One-time setup (the Worker's own runtime config)

1. **Create the KV namespace** (if you haven't already) and put its id in `wrangler.jsonc`:
   ```bash
   wrangler kv namespace create sportcraft-kv
   ```
   Paste the returned id into `kv_namespaces[0].id` in `wrangler.jsonc`. If you'll also run
   `wrangler dev` against real KV, create a second namespace for `preview_id`.

2. **Set the session secret** — a required secret, no default exists:
   ```bash
   wrangler secret put SECRET
   ```
   Any long random string. Generate one with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Rotating it invalidates every existing session (forces re-login) — not destructive to data.

3. **Regenerate types** after touching `wrangler.jsonc`'s bindings:
   ```bash
   npm run cf-typegen
   ```

That's the complete list of required Cloudflare configuration — there is no database to provision, and
no other secret or env var is read anywhere in this codebase.

## Deploying

**Normal case: push to the connected branch.** The pipeline above handles the rest — no local command
needed.

**Manual/local deploy** (e.g. testing a deploy from your own machine, or if the pipeline isn't set up
yet) still works the same way it would for any OpenNext-on-Cloudflare project:

```bash
npm run deploy      # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

This requires `wrangler login` first if you haven't authenticated this machine to the Cloudflare
account before.

## Provisioning the first Super Admin

Production has **no self-service or in-app path** to become Super Admin, and no auto-seeded demo
account (seeding is dev-only — see `04-local-development.md`). The first Super Admin account has to be
written into KV directly:

```bash
# 1. Hash a real password the same way password.ts does (PBKDF2-SHA256, 100k iterations, 32-byte key)
node -e "
const crypto = require('crypto');
const password = process.argv[1];
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
console.log(JSON.stringify({ passwordHash: hash.toString('hex'), passwordSalt: salt.toString('hex') }));
" "your-real-password"

# 2. Write the user record (fill in the hash/salt from step 1, a fresh "u_" + random-hex id, and an ISO timestamp)
wrangler kv key put --namespace-id=<KV_NAMESPACE_ID> \
  "user:u_XXXXXXXX" \
  '{"userid":"u_XXXXXXXX","name":"Your Name","email":"you@example.com","passwordHash":"<hash>","passwordSalt":"<salt>","isSuperAdmin":true,"memberships":[],"createdAt":"<ISO timestamp>"}'

# 3. Write the email index so login can find it
wrangler kv key put --namespace-id=<KV_NAMESPACE_ID> \
  "idx:email:you@example.com" \
  '"u_XXXXXXXX"'
```

Then log in normally at `/` — this is the same `verifyLogin` path every account uses, no special
bootstrap code involved. `memberships: []` is correct: Super Admin doesn't need org membership to
operate, and lands on `/app/admin/organizations` (no active tournament to show yet).

From there, every subsequent org either comes through the request/approval flow
([`03-auth-and-roles.md`](./03-auth-and-roles.md)) or via the Super Admin's direct-create shortcut on
that same page.

## Post-deploy checklist

- [ ] `SECRET` is set (`wrangler secret list` to confirm — value isn't shown, just presence).
- [ ] KV namespace id in `wrangler.jsonc` matches a real namespace, not a placeholder.
- [ ] First Super Admin KV record written (above).
- [ ] Logged in as that Super Admin and confirmed you land on `/app/admin/organizations`.
