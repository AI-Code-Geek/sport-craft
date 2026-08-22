# API reference

All routes live under `src/app/api/**/route.ts`. Every request needs a valid session cookie **except**
`/api/auth/*` and `POST /api/organizations/requests` (the only two ways to reach the app signed out).
`middleware.ts` also blocks any cross-origin `POST`/`PATCH` (Origin/Host mismatch → CSRF rejection).

Auth column: **Public** = no session needed · **Any** = any signed-in user · **Org Admin** = Org Admin
or Super Admin, scoped to the caller's active org · **Super Admin** = platform Super Admin only.

## Auth

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | Public | Join an org by invite code → pending "player" membership. |
| `/api/auth/login` | POST | Public | Verify credentials, issue session cookie. Rate-limited (10 failed/10min/IP). |
| `/api/auth/logout` | POST | Any | Clear the session cookie. |
| `/api/me` | GET | Any | Current user, active org, feature flags, all memberships, active tournament + role context. |
| `/api/me/switch-org` | POST | Any | Re-sign the session against a different **active** membership. |

## Organizations (platform-level)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/organizations/requests` | POST | Public | Submit a "create my org" request (name, sport, features). |
| `/api/organizations/requests` | GET | Super Admin | List every org request. |
| `/api/organizations/requests/[id]` | PATCH | Super Admin | `{action: "approve"\|"reject"}`. |
| `/api/organizations` | GET | Super Admin | Every org, with member count + current Org Admins. |
| `/api/organizations` | POST | Super Admin | Create an org directly, bypassing the request queue. |

## An org's own settings & members

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/community` | GET | Org Admin | Get the caller's active org's identity. |
| `/api/community` | PATCH | Org Admin | Rename, change sport, toggle features, regenerate invite code. |
| `/api/community/users` | GET | Org Admin | Active members + pending join requests for the caller's active org. |
| `/api/community/users` | PATCH | Org Admin | `{userId, role?, suspended?}` or `{userId, decision: "approve"\|"reject"}`. |

## Tournaments

All `/api/tournaments/[id]/**` routes resolve the tournament, confirm it belongs to the caller's
active org, then apply the auth column below (`canManageTournament` = Super Admin or that org's Org
Admin — see [`03-auth-and-roles.md`](./03-auth-and-roles.md)).

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/tournaments` | GET | Any | List the caller's active org's tournaments. |
| `/api/tournaments` | POST | Org Admin | Create a tournament. |
| `/api/tournaments/[id]` | GET / PATCH | Any / Org Admin | Read / edit tournament variables. |
| `/api/tournaments/[id]/poll` | GET / POST | Any / Org Admin | Read poll; `{action: "open"\|"close"\|"freeze"}`. |
| `/api/tournaments/[id]/poll/vote` | POST | Any | `{action: "join"\|"withdraw", userId?}` — Org Admin/Super Admin may act on another `userId`. |
| `/api/tournaments/[id]/poll/promote` | POST | Org Admin | Manually promote a waitlisted entry. |
| `/api/tournaments/[id]/captains` | GET / POST | Any / Org Admin | Read confirmed-pool candidates; set captains + name teams. |
| `/api/tournaments/[id]/teams` | GET | Any | Team directory + rosters. |
| `/api/tournaments/[id]/positions` | GET / POST | Any / Org Admin | Read position state; assign a player, or `{finalize: true}`. |
| `/api/tournaments/[id]/auction` | GET / POST | Any / Org Admin | Read auction state; `{action: "start"\|"pause"}`. |
| `/api/tournaments/[id]/auction/bid` | POST | Captain | `{amount}` — place a bid for the caller's team. |
| `/api/tournaments/[id]/auction/resolve` | POST | Org Admin | Force-resolve the current nominee. |
| `/api/tournaments/[id]/auction/skip` | POST | Org Admin | Skip the current nominee. |
| `/api/tournaments/[id]/schedule` | GET / POST | Any / Org Admin | Read schedule; generate/regenerate it. |
| `/api/tournaments/[id]/matches/[matchId]` | GET / PATCH | Any / Org Admin | One match's detail; `{scheduledAt?, venue?, court?}` to reschedule it (score untouched). |
| `/api/tournaments/[id]/matches/[matchId]/score` | POST | Org Admin | `{action: "start"\|"point"\|"undo"\|"nextset"\|"end"\|"reopen", side?}`. `start` marks a scheduled match live at 0-0; `reopen` undoes `end` (reopens the last set, clears the winner) so a mis-scored match can be corrected and ended again. |
| `/api/tournaments/[id]/standings` | GET | Any | Computed standings table. |
| `/api/tournaments/[id]/bracket` | GET / POST | Any / Org Admin | Read bracket; generate it. |
| `/api/tournaments/[id]/notifications` | GET / POST | Any | Read this user's visible notifications; mark seen. |

## Client wrappers

Every route above has a typed wrapper in `src/lib/api-client.ts` — a client component should always go
through those (e.g. `getPoll(id)`, `pollAction(id, "open")`) rather than calling `fetch` directly, so
the request/response shape stays in one place.
