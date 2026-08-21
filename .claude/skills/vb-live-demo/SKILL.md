---
name: vb-live-demo
description: Drives the Estancia Volleyball League app (C:\mythigs\volleballTournament) through its full tournament lifecycle live in the browser — poll signup, captain selection, position categorization, live position-based auction bidding across multiple captain logins, schedule generation, live scoring, standings, and playoff bracket — while also demonstrating what each role (Super Admin, Organizer, Captain, Player) sees. Use whenever asked to "demo", "walk through", "test", or "show" the volleyball app's workflow end to end.
---

# Estancia Volleyball League — live UI walkthrough

This app has **no database — everything is Cloudflare KV** (see `docs/DEVPLAN.md` §3). Local dev
persists KV to disk at `.wrangler/state/`, so state survives restarts. There is always one **lazily
seeded** community ("Estancia Recreation Club") with one fully-played demo tournament ("Estancia
Summer Volleyball League 2026" — poll closed, auction complete, 9/15 matches played). **Never touch
that seeded tournament during a demo** — re-saving its captains/positions/etc. can regress its
status or wipe its rosters (that bug is fixed, but the point of this skill is to demo the *live*
lifecycle, which the seeded tournament has already finished). Instead, **create a brand-new
tournament** for the walkthrough — creating one makes it the community's "active" tournament, so
`/app/*` pages immediately reflect it.

## 0. Setup

```bash
cd C:/mythigs/volleballTournament
npm install          # first run only
npm run dev           # starts on http://localhost:3100 — NOT 3000, that's commonly taken by another project
```

Wait for `http://localhost:3100/` to return 200 before opening the browser (poll with `curl`, don't
guess a fixed sleep). If you want a guaranteed-clean seed first, stop the dev server and delete
`.wrangler/state/`, then restart — the next request reseeds from scratch (takes a few seconds; the
seed runs the poll/captain/auction/schedule engine for real, it isn't instant).

**Demo credentials — every account uses the same password `volleyball2026`:**

| Role | Name | Email |
|---|---|---|
| Super Admin | Meera Iyer | `meera.success@gmail.com` |
| Organizer | David Kim | `david.kim@estancia.demo` |
| Organizer | Priya Nair | `priya.nair@estancia.demo` |
| Captain (after you assign them — pick any 6 from the confirmed pool) | e.g. Meera Santos | `meera.santos1@estancia.demo` |
| Player | any other confirmed voter | see `/app/admin/users` as Super Admin for the full list |

## 1. Role-switching tour (do this first — it's the fastest way to show the RBAC model)

Load the browser tools if not already loaded: `ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__tabs_create_mcp")`.

Open a tab, navigate to `http://localhost:3100/`, screenshot the landing page (login/register tabs,
pre-filled Super Admin demo credentials).

For each role below: use `javascript_tool` to POST `/api/auth/login` directly (fast, no form-filling
needed — this sets the session cookie for the current tab), then navigate to `/app` and screenshot.
Call out what's different in the nav / home page each time:

```js
const res = await fetch('/api/auth/login', {
  method: 'POST', credentials: 'same-origin',
  headers: {'content-type':'application/json'},
  body: JSON.stringify({email:'<email>', password:'volleyball2026'})
});
(await res.json()).user?.name
```

- **Super Admin** (`meera.success@gmail.com`) — nav shows an "Admin" link; the Nav badge reads
  "Super Admin"; `/app/admin` shows the full tool grid including "New tournament", "Organizers",
  "Users" (super-admin-only tiles) plus every organizer tool.
- **Organizer** (`david.kim@estancia.demo`) — nav badge reads "Organizer"; `/app/admin` shows the
  operational tools (poll, captains, positions, auction, schedule, scoring, playoffs) but NOT "New
  tournament" / "Organizers" / "Users".
- **Captain** (any team's captain, once assigned — see §3) — nav badge reads "Captain" (amber); no
  Admin link; `/app/auction` shows a live bid panel instead of a read-only view when it's their
  team's turn.
- **Player** (any confirmed non-captain) — no badges at all; fully participant-only nav (Home, Poll,
  Teams, My Team, Auction, Schedule, Standings, Bracket).

## 2. Create a fresh tournament (Super Admin)

Log in as `meera.success@gmail.com`. Navigate to `/app/admin/tournaments/new`. The form is
pre-filled with sane defaults (6 teams, team size 6, 100 auction points, best-of-3 to 25, playoff
cutoff 4) — click **Create tournament**. This immediately becomes the community's active tournament.
Screenshot the admin console (`/app/admin`) — the lifecycle stepper now shows "Poll" as current,
everything else greyed out.

## 3. Fill the poll to capacity (36) and pick captains

Filling the poll one-by-one through the UI for 36 people is impractical to demonstrate live — do it
via `javascript_tool` fetch calls while logged in as Super Admin (still valid, no re-login needed),
then show the **result** in the UI. This exercises the real `/api/tournaments/:id/poll/vote` endpoint
per user, not a shortcut:

```js
const T = /* the new tournament's id, from POST /api/tournaments response or GET /api/me */;
const users = await (await fetch('/api/community/users')).json();
const staff = ['meera.success@gmail.com','david.kim@estancia.demo','priya.nair@estancia.demo'];
const voters = users.users.filter(u => !staff.includes(u.email)).slice(0, 36);
await fetch(`/api/tournaments/${T}/poll`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({action:'open'})});
for (const v of voters) {
  await fetch(`/api/tournaments/${T}/poll/vote`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({action:'join', userId:v.userid})});
}
'joined ' + voters.length;
```

Navigate to `/app/admin/poll` and screenshot — 36/36 confirmed, capacity meter full, entry table in
signup order.

**Pick captains through the real UI** (this part IS worth clicking through, it's the redesigned
2-step flow): `/app/admin/captains`.
- **Step 1 "Name your teams"** — rename the 6 default team cards (e.g. Estancia Smashers / Net
  Ninjas / Sunset Spikers / Block Party / Ace Avengers / Rally Rebels), pick a color swatch on each,
  click **Next: pick captains →**.
- **Step 2 "Pick captains"** — click a team card (it highlights, shows "Pick a player below ↓"),
  then click a player chip in the confirmed-players grid below to assign them; watch it auto-advance
  to the next empty team. Repeat for all 6. Note the already-picked players show a colored "Captain"
  badge and become unclickable. Click **Confirm captains →** once all 6 have one.

## 4. Position categorization (kanban board)

Navigate to `/app/admin/positions`. The 30 non-captain confirmed players are auto-round-robin'd into
5 category cards (Setter / Spiker 1 / Spiker 2 / Back Player 1 / Back Player 2), each already reading
`6/6 ✓` as a starting point. Demonstrate the move interaction — either:
- **Drag** a player chip from one card onto another (native HTML5 drag, works in a real browser); or
- Use the compact `<select>` on a chip (more reliable for automated tooling — use `form_input`, not
  `left_click`, to change a select's value) — move someone, screenshot the source card dropping to
  `5/6` and the target rising to `7/6` (amber, not "full"), then move them back.

Click **Start auction →** (disabled unless every card reads exactly `N/6`).

## 5. Live auction — bid as different captains, resolve as admin

`/app/admin/auction` (organizer/admin control) and `/app/auction` (captain/spectator view) both show
the same live state, polling every 3s.

1. Screenshot `/app/auction` as Super Admin first — read-only, "No bids yet — first eligible bid
   wins the floor."
2. `javascript_tool`-login as **captain #1** (e.g. `meera.santos1@estancia.demo`), reload
   `/app/auction`. Notice the nav badge changes to "Captain" and a "Your bid" panel appears. Use
   `find` to locate the "+5" button and click it (or type a custom amount + click "Bid").
3. `javascript_tool`-login as **captain #2** (a different team), reload, place a higher bid — show
   the "is high bidder" label switching teams.
4. Log back in as captain #1, try to bid **lower** than the current bid — the panel now shows a
   friendly rejection ("That bid isn't higher than the current bid.") instead of a raw error code.
5. `javascript_tool`-login as an **Organizer** (`david.kim@estancia.demo`) — if David isn't an
   organizer for this NEW tournament (only the creator is, by default), this correctly 403s; that's
   the per-tournament organizer scoping working, not a bug. Log in as Super Admin instead, navigate
   `/app/admin/auction`, click **Mark sold →** — screenshot the budget rail updating (slot filled,
   points deducted) and the board advancing to the next nominee.

To reach `auction_complete` without clicking through all 30 picks, fast-forward the rest via repeated
`POST /api/tournaments/:id/auction/resolve` calls (Super Admin session) — each call auto-assigns the
current nominee to the lowest-budget eligible team when no bid was placed, which is realistic enough
for a demo and exercises the real resolve/advance logic:

```js
while (true) {
  const r = await fetch(`/api/tournaments/${T}/auction/resolve`, {method:'POST'});
  if (!r.ok) break; // "auction_not_live" once every category is full
}
```

## 6. Schedule → live scoring → standings → playoffs

- `/app/admin/schedule` — form is pre-filled (Estancia Community Gym, Court A/Court B, 18:00 &
  19:15, a start date, 7 days between rounds). Click **Generate & publish schedule** — screenshot the
  15-match round robin that appears (3 matches/round × 5 rounds, no double-booked court+time).
- `/app/admin/scoring` — pick a match, click the **+1** buttons a few times for each side (use `find`
  to re-locate the button each click rather than reusing a stale ref if the page re-rendered), show
  the score updating. Note: click at a **human pace** — the +1/−1/next-set/end-match buttons disable
  themselves while a request is in flight (`busyRef` lock in `admin/scoring/page.tsx`) specifically
  because Cloudflare KV has no compare-and-swap and truly simultaneous requests can race; scripted
  clicks fired faster than a render cycle can still slip past the guard, so don't hammer it in a tight
  loop when demoing. Once a set reaches 25 (win by 2), **Start next set** enables; **End match** any
  time to finalize and feed standings.
- `/app/standings` — screenshot the computed table (league points → set ratio → head-to-head → point
  differential tie-break, per `src/lib/standings.ts`).
- `/app/admin/playoffs` — set the cutoff (2/4/8 only — see `SUPPORTED_PLAYOFF_COUNTS` in
  `bracket-store.ts`), click **Generate bracket →**, then `/app/bracket` to see the seeded rounds.

## 7. Participant views (Player login)

Log in as any non-captain confirmed voter and tour `/app/poll` (their own status + capacity meter),
`/app/teams` (all rosters), `/app/teams/mine` (empty state if not on a team, else their roster/budget/
matches), `/app/schedule`, `/app/matches/<id>` (live scoreboard, auto-polls while status is `live`),
`/app/standings`, `/app/bracket` — all read-only, no admin controls visible anywhere.

## Known quirks to work around while demoing

- **Coordinate clicks drift** when the viewport height differs between screenshots (nav height,
  scroll position). Prefer `find` (by visible text/role) or `form_input` (for selects) over hardcoded
  `[x, y]` coordinates — several earlier manual runs mis-clicked this way.
- **Stale session after a KV wipe**: if `.wrangler/state/` was deleted and the dev server restarted
  mid-session, an already-open tab's cookie is still cryptographically valid (HMAC-signed) but points
  at a userid that no longer exists in the fresh store — `/api/me` returns `{user:null}` even though
  the page *looks* logged in (the Nav's "Sign out" button isn't conditional on a valid session). If a
  page shows unexpectedly empty state, re-run the login fetch before assuming a real bug.
- **Never resubmit the seeded tournament's captains/positions** unless intentionally demoing the
  edit flow — `setCaptainsAndNames` now preserves an unchanged captain's roster/budget and never
  regresses `tournament.status`, but a genuinely *changed* captain still resets that one team's roster
  to just-the-new-captain, which is correct but destructive if unintended.
