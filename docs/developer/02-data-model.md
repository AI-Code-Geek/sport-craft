# Data model & KV layout

Everything lives in one Cloudflare KV namespace (binding `KV`). Each row below is one KV key; values
are JSON blobs (or a plain string for the two index cases noted). Types are defined in
`src/lib/types.ts`; each `*-store.ts` in `src/lib` owns the reads/writes for its rows.

## Organizations & accounts

| Key | Value | Store |
|---|---|---|
| `community:<id>` | `Community` | `community-store.ts` |
| `idx:community-slug:<slug>` | `id` (string) | `community-store.ts` |
| `idx:communities` | `id[]` | `community-store.ts` |
| `org-request:<id>` | `OrganizationRequest` | `org-request-store.ts` |
| `idx:org-requests` | `id[]` | `org-request-store.ts` |
| `user:<userid>` | `UserRecord` | `user-store.ts` |
| `idx:email:<email>` | `userid` (string) | `user-store.ts` |
| `idx:community-users:<communityId>` | `userid[]` | `user-store.ts` |

```ts
type SportType = "volleyball" | "basketball" | "soccer" | "softball" | "pickleball" | "other";
type FeatureKey = "poll" | "scheduler" | "teams" | "positions" | "auction"
                | "liveScoring" | "brackets" | "notifications";

interface Community {
  id: string; name: string; slug: string;
  sport: SportType;
  features: Record<FeatureKey, boolean>;   // gates nav + admin console per org
  inviteCode: string;                       // what players register against
  createdAt: string;
}

type CommunityRole = "org_admin" | "player";
type MembershipStatus = "pending" | "active";

interface Membership {                      // one account's relationship to ONE org
  communityId: string;
  role: CommunityRole;
  status: MembershipStatus;                 // "pending" = awaiting that org's Org Admin approval
  suspended: boolean;
  joinedAt: string;
}

interface UserRecord {
  userid: string; name: string; email: string;
  passwordHash: string; passwordSalt: string;   // PBKDF2-SHA256, 100k iterations — see 03-auth-and-roles.md
  isSuperAdmin: boolean;                    // platform-level, orthogonal to memberships
  memberships: Membership[];                // one account, many orgs
  lastActiveCommunityId?: string;           // which org a new session resumes into
  createdAt: string; lastLoginAt?: string;
  notificationsSeenAt?: Record<string, string>;  // tournamentId -> ISO timestamp
}

type OrgRequestStatus = "pending" | "approved" | "rejected";

interface OrganizationRequest {             // a "create my org" submission, pre-approval
  id: string; orgName: string; sport: SportType; features: Record<FeatureKey, boolean>;
  requesterName: string; requesterEmail: string;
  requesterPasswordHash: string; requesterPasswordSalt: string;  // hashed at submission, never plaintext
  status: OrgRequestStatus; communityId?: string;   // set once approved
  createdAt: string; decidedAt?: string; decidedBy?: string;
}
```

`publicUser(user, communityId?)` in `types.ts` is the *only* place a `UserRecord` should ever be
projected for a response — it always strips `passwordHash`/`passwordSalt`, and resolves
`role`/`status`/`suspended` for the one org context you pass in (or `null` if you don't).

## Per-tournament data

Each tournament's data is its own set of keys, all scoped by `tournamentId`:

| Key | Value | Store |
|---|---|---|
| `tournament:<id>` | `Tournament` | `tournament-store.ts` |
| `idx:community-tournaments:<communityId>` | `id[]` (creation order; last = "active") | `tournament-store.ts` |
| `poll:<tournamentId>` | `Poll` | `poll-store.ts` |
| `teams:<tournamentId>` | `Team[]` | `team-store.ts` |
| `positions:<tournamentId>` | `PositionsState` | `position-store.ts` |
| `auction:<tournamentId>` | `AuctionState` | `auction-store.ts` |
| `matches:<tournamentId>` | `Match[]` | `match-store.ts` |
| `bracket:<tournamentId>` | `Bracket` | `bracket-store.ts` |
| `notifications:<tournamentId>` | `AppNotification[]` (capped, append-only) | `notification-store.ts` |

A community's **active tournament** is simply the *last* id in
`idx:community-tournaments:<communityId>` — there's no separate "current" pointer to keep in sync.

**Standings are never stored.** `src/lib/standings.ts` computes them on every read from
`matches:<tournamentId>` + `teams:<tournamentId>` — league points → set ratio → head-to-head → point
differential, in that tie-break order.

See `src/lib/types.ts` for the full shape of `Tournament`, `Poll`/`PollEntry`, `Team`/`RosterEntry`,
`PositionsState`, `AuctionState`/`AuctionLogEntry`, `Match`/`SetScore`, `Bracket`/`BracketRound`, and
`AppNotification` — each is a small, flat interface and mostly self-explanatory from its field names
and inline comments.

## Misc

| Key | Value | Store |
|---|---|---|
| `rl:<bucket>:<id>` | fixed-window attempt counter, TTL = the window | `rate-limit.ts` |
| `idx:seeded:v1` | seed marker (dev only — see `04-local-development.md`) | `seed.ts` |

## Design conventions worth knowing

- **Whole-blob rewrites.** Arrays like `Team[]` or `Match[]` are read, mutated in memory, and written
  back whole. Fine at this scale (a tournament's roster/schedule is at most low hundreds of rows) —
  don't reach for partial updates.
- **`idx:*` keys are just id lists**, appended/removed via `idxAppend`/`idxRemove`/`idxList` in
  `src/lib/kv.ts` — the same small pattern used everywhere an entity needs a "list all X" query.
- **Local dev still uses real KV.** `next.config.ts` calls `initOpenNextCloudflareForDev()`, which
  gives plain `npm run dev` a real, disk-persisted Miniflare KV store under `.wrangler/state/` — not a
  mock. `src/lib/kv.ts` only falls back to an in-process `Map` in contexts with no Cloudflare binding
  at all (e.g. some build phases). See `04-local-development.md`.
