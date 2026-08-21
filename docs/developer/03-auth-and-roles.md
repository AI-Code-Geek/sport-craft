# Auth, sessions & roles

## Password storage

`src/lib/password.ts` — PBKDF2-SHA256, 100,000 iterations, a fresh random 16-byte salt per user
(Web Crypto only, so it runs identically in Edge middleware and the Worker). Only `passwordHash` +
`passwordSalt` (hex strings) are ever persisted; `verifyPassword` does a constant-time comparison.
Nothing in this codebase ever stores or logs a plaintext password — not even momentarily (the
org-request queue hashes at submission time, before the org is even created).

## Sessions

A self-verifying, signed httpOnly cookie (`src/lib/session.ts`) — HMAC-SHA256 over the payload with
the `SECRET` env var. No KV read is needed to validate a request; `middleware.ts` checks the signature
and expiry on every `/app/**` and `/api/**` request.

```ts
interface Session {
  userid: string;
  isSuperAdmin: boolean;              // platform flag, independent of any org
  communityId: string | null;         // the ACTIVE org for this session, or null
  role: "org_admin" | "player" | null; // role within that active org
  exp: number;                         // epoch seconds
}
```

`communityId`/`role` describe one **active** org at a time — switching orgs (`/api/me/switch-org`)
re-signs a new cookie against a different membership; it doesn't require re-login. See
`src/lib/user-store.ts`'s `resolveActiveMembership()` for how login picks which org to resume into
(prefers `lastActiveCommunityId`, falls back to the first active membership, `null` if none).

## Roles

| Role | Scope | Granted by |
|---|---|---|
| **Super Admin** | Platform-wide, orthogonal to org membership | Manually, via a hand-written KV `user:<id>` record (`isSuperAdmin: true`) or the dev seed. **No in-app or self-service path exists.** |
| **Org Admin** | One org (a `Membership.role`) | Automatically for the founding requester when their org-creation request is approved; or promoted later by an existing Org Admin/Super Admin from the Users page. |
| **Player** | One org (a `Membership.role`) | Default role for anyone who joins an org via invite code. |

An account can hold a **different role in each org** it belongs to — Org Admin of one, Player of
another. See `src/lib/authz.ts`:

```ts
isSuperAdmin(session)                          // session.isSuperAdmin
isOrgAdminOf(session, communityId)              // session.communityId === communityId && session.role === "org_admin"
canManageTournament(tournamentId, session)      // isSuperAdmin(session) || isOrgAdminOf(session, tournament.communityId)
```

## Approval flows

Two separate request queues, reviewed by two different people:

**1. Creating an org** — reviewed by a **Super Admin**
```
POST /api/organizations/requests (public, no auth)
   → OrganizationRequest { status: "pending" }, password hashed immediately
Super Admin: PATCH /api/organizations/requests/[id] { action: "approve" | "reject" }
   → approve: creates the Community, creates the account if it doesn't already exist
              (createAccountFromHash — reuses the hash from the request), and adds an
              ACTIVE org_admin Membership. The requester is now that org's founding Org Admin.
   → reject:  marks the request rejected; nothing else is created.
```

**2. Joining an org** — reviewed by *that org's* **Org Admin**
```
POST /api/auth/register { inviteCode, name, email, password }
   → joinCommunity(): if the email already has an account elsewhere, verifies the password
     matches and adds a new membership; otherwise creates the account first.
   → Always adds a PENDING "player" Membership — never auto-approved.
Org Admin: PATCH /api/community/users { userId, decision: "approve" | "reject" }
   → approve: membership.status → "active"
   → reject:  the membership row is removed entirely (idxRemove from that org's member index)
```

A session's `communityId` only ever points at an **active** membership. Someone who has only pending
memberships gets a session with `communityId: null` and sees an "awaiting approval" screen
(`src/app/app/page.tsx`) instead of the app shell.

## Feature flags

`Community.features: Record<FeatureKey, boolean>` — chosen at org-request time, editable later from
Org Settings (`/app/admin/settings`). `src/components/Nav.tsx` and `src/app/app/admin/page.tsx` both
filter their link/tool lists by `features[key] !== false` (default-on if the flag is missing, so a
mid-flight config change never surprises anyone). Disabling a feature only hides UI — it doesn't touch
already-stored data, so re-enabling it later picks up right where it left off.

## Rate limiting

`src/lib/rate-limit.ts` — a fixed-window counter per IP+bucket in KV (`rl:<bucket>:<id>`, TTL = the
window). Login is capped at 10 failed attempts / 10 minutes per IP (`src/app/api/auth/login/route.ts`).
Fails **open** if KV is unavailable — never blocks a legitimate request because the limiter itself is
down; pair with a Cloudflare WAF rule for a hard edge cap in production.
