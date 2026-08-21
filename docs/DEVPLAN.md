# Estancia Volleyball League — End-to-End Dev Plan

**Status:** PLAN
**App:** `volleyball-tournament-next-js` (Next.js on Cloudflare Workers via OpenNext — same stack as
`aiqtrader-next-js`)
**Role in the system:** Full-stack community tournament manager. A **Super Admin** stands up each
tournament and staffs it with **Organizers**, who then run it end to end (poll → captains →
position-based auction → schedule → live scoring → playoffs); every registered community member can
vote in the poll and follow their team, the schedule, live scores, and standings.

---

## 1. What we're building

A community (e.g. **Estancia**) runs a recreational volleyball league in two tiers of ownership and
five operational stages:

- **Super Admin** creates the tournament (name + the core variables — team count, roster size,
  auction budget, scoring rules, playoff cutoff) and **assigns one or more Organizers** to run it.
  This is a light, infrequent action — one community can have Super Admins run several tournaments a
  year, each staffed by a different committee.
- **Organizers** (the assigned committee for that tournament) then own the day-to-day: they open the
  poll, pick captains, categorize players, run the auction, publish the schedule, score matches, and
  set the playoff cutoff. Everything below is the Organizer's workflow unless noted.

1. **Poll (signup):** Organizer opens a poll with a configured **capacity** (e.g. 6 teams × 6 players
   = 36). Registered members opt in; the **first N to opt in are auto-confirmed**, the rest land on a
   **waitlist**. Organizer can **freeze** the poll manually or it auto-freezes at capacity.
2. **Team formation (captains → position categorization → live auction):**
   a. Organizers hand-pick **captains** (one per team, from the confirmed pool) and name each team.
      Each captain is credited a fixed **budget** (e.g. 100 points) for that tournament.
   b. Organizers sort the remaining confirmed players into **skill/position categories** — one
      category per remaining roster slot (team size 6 → 5 categories: **Setter, Spiker 1, Spiker 2,
      Back Player 1, Back Player 2**). Each category ends up with exactly `max_teams` players, so
      every team can win exactly one per category.
   c. **Live auction, run one position category at a time:** every player in the current category is
      nominated in turn; all captains who still need that position bid points; highest bid wins the
      player onto that captain's team. Once every team has filled the category, the next category
      opens — repeat until every team's roster is complete (captain + one player per category).
3. **Scheduling:** Organizer picks tournament days/time-slots/venues and a **generation algorithm**
   (round robin to start; others pluggable) to auto-build the match schedule. Organizer can
   regenerate or hand-edit before publishing.
4. **Live scoring:** During a match, an organizer/scorekeeper enters set-by-set scores in real time.
   Participants watch the live scoreboard. On completion the match result feeds standings.
5. **Standings → playoffs:** Standings (wins, set ratio, points) are computed from completed matches.
   Organizer configures how many teams advance (e.g. top 4) and generates a **knockout bracket**;
   scheduling + live scoring repeat for playoff rounds.

### Personas
- **Super Admin** — community-level owner. Creates/edits tournaments' core identity, assigns and
  removes Organizers per tournament, manages community membership/roles. Rarely touches day-to-day
  poll/auction/scoring tools directly, but can (superset of Organizer permissions) as a break-glass
  fallback.
- **Organizer (Committee member)** — assigned to a specific tournament by a Super Admin. Runs that
  tournament's entire operational workflow: poll, captains, position categorization, auction,
  schedule, live scoring, playoff cutoff. A community can run multiple tournaments in parallel with
  different Organizer committees on each.
- **Captain** — a confirmed player elevated for the auction: bids their team's budget on players,
  scoped to the position categories they still need. Otherwise behaves like a regular participant.
- **Player (participant)** — every registered community member. Votes in the poll, views their team
  once formed, views the schedule, watches live scores, views standings/bracket.

### Non-goals (v1)
- No payments/dues collection, no photo uploads, no chat/messaging.
- No true push/WebSocket scoring — v1 uses short-interval polling (see §3); Durable Objects/WS is a
  deferred upgrade, not required to ship.
- No multi-sport generalization — volleyball set-scoring rules only (best-of-3 or best-of-5, sets to
  25/15, configurable per tournament but not per-sport pluggable).
- Auction concurrency is "good enough" optimistic locking (see §4), not a fairness-audited real-money
  auction engine.

---

## 2. Domain model (data contract)

Relational by nature (teams ↔ players ↔ matches ↔ sets, auction bids, poll ordering) → **Cloudflare
D1** (SQLite) is the right store here, unlike the read-only reports app this is patterned after. KV is
still used for cheap session/user-lookup caching (see §3).

```
communities        id, name, slug, created_at
users              id, community_id, name, email, phone, password_hash,
                   role (admin|organizer|player, default player), created_at
                   -- "captain" is NOT a stored role: it's derived from teams.captain_user_id
                   -- for the active tournament. Same for "organizer" being promotable per-tournament
                   -- via tournament_roles if a community wants per-event committees (v1.1).

tournaments        id, community_id, name, status, created_by,
                   max_teams, team_size,            -- e.g. 6, 6
                   budget_points,                    -- e.g. 100 per captain
                   poll_capacity,                     -- default max_teams*team_size
                   sets_to_win, points_per_set, win_by,  -- scoring rules, e.g. best-of-3, 25, 2
                   playoff_team_count,                -- e.g. 4
                   poll_opened_at, poll_closed_at
                   -- status: draft | poll_open | poll_closed | captains_selected | positions_set |
                   --         auction_live | auction_complete | schedule_published | in_progress |
                   --         playoffs | completed

poll_entries       id, tournament_id, user_id, status (confirmed|waitlisted|withdrawn),
                   submitted_at                      -- confirmation = first `poll_capacity` by this ts

tournament_organizers  tournament_id, user_id, assigned_by, assigned_at
                   -- the committee a Super Admin staffs onto a tournament (§1/§4). Composite PK
                   -- (tournament_id, user_id). Presence of a row = that user is an Organizer for
                   -- that tournament (and only that tournament).

teams              id, tournament_id, name, captain_user_id, budget_remaining

position_categories id, tournament_id, name, sort_order
                   -- one row per remaining roster slot, i.e. (team_size - 1) rows.
                   -- default volleyball set for team_size=6: Setter, Spiker 1, Spiker 2,
                   -- Back Player 1, Back Player 2 — editable per tournament, not hardcoded.

auction_players    id, tournament_id, user_id, position_category_id,
                   status (unassigned|available|nominated|sold),
                   team_id (nullable), sold_price (nullable)
                   -- seeded 1 row per confirmed non-captain poll_entry when captains are confirmed;
                   -- `position_category_id` starts null and is set by the organizing committee during
                   -- the positions_set stage (drag-to-bucket UI) — every row must be categorized
                   -- before the auction can start. Bucket sizes should net to `max_teams` each so
                   -- every team can win exactly one per category (validated, not enforced by schema).

auction_state      tournament_id (PK), status (not_started|live|paused|complete),
                   round_order JSON (position_category_id[]), current_round_index,
                   nomination_order JSON (user_id[] scoped to current round), current_index,
                   current_bid_amount, current_bid_team_id, turn_deadline_at
                   -- bidding is scoped to one position_category at a time: every player in the
                   -- current round's category is nominated and sold before the next round opens.
                   -- a captain who has already won this round's category is skipped when bidding
                   -- reopens (they keep bidding rights in every *other* still-open category).

auction_bids       id, tournament_id, auction_player_user_id, team_id, amount, placed_at
                   -- append-only audit log; auction_state holds the derived "current high bid"

matches            id, tournament_id, round (group|quarterfinal|semifinal|final),
                   team_a_id, team_b_id, scheduled_at, venue, court,
                   status (scheduled|live|completed|cancelled),
                   winner_team_id (nullable)

sets               id, match_id, set_number, team_a_points, team_b_points,
                   status (in_progress|completed)

standings          -- materialized read model, recomputed on every match completion:
                   tournament_id, team_id, played, won, lost, sets_won, sets_lost,
                   points_for, points_against, league_points, rank

bracket_slots      id, tournament_id, round, position, team_id (nullable until seeded),
                   source_match_id (nullable)        -- winner-feeds-into for later rounds
```

**Poll confirmation rule:** on submit, count `poll_entries` with `status='confirmed'` for the
tournament; if `< poll_capacity`, insert as `confirmed`, else `waitlisted`. When a confirmed entry is
withdrawn, promote the oldest `waitlisted` entry (FIFO) to `confirmed`. This is the same
"first-N-wins, everyone else queues" rule as a conference CFP or a capped RSVP list.

**Auction turn order:** simple round-robin over `teams` (nominate → highest confirmed bid wins →
next team's turn to nominate), continuing until every team's roster is full or the player pool is
exhausted. A captain who has filled their roster or exhausted budget is skipped in the rotation.

**Standings tie-break:** league points (win=2/loss=0 typical rec-league scoring, configurable) →
set ratio → head-to-head → points differential.

---

## 3. Architecture — Cloudflare Workers (OpenNext) + D1 + KV

```
   ┌───────────────────────────────────────────────────────────────────┐
   │  Next.js (App Router) on Cloudflare Workers (OpenNext)             │
   │                                                                     │
   │  D1 (SQLite, binding DB) — source of truth for everything in §2:   │
   │    communities/users/tournaments/poll_entries/teams/               │
   │    auction_players/auction_state/auction_bids/matches/sets/        │
   │    standings/bracket_slots                                         │
   │                                                                     │
   │  KV (binding KV) — cheap, high-read-volume lookups only:           │
   │    session:<token> -> {userId, communityId, role, exp}   (auth)    │
   │    live:<tournamentId>:<matchId> -> latest set score snapshot      │
   │      (denormalized cache so the scoreboard poll hits KV, not D1,   │
   │       during a live match's write-heavy minute-by-minute updates)  │
   │                                                                     │
   │  src/lib/db.ts        — typed D1 query helpers (one per table)     │
   │  src/lib/auth.ts      — session cookie (HMAC-signed) + KV session  │
   │  src/lib/poll.ts      — confirm/waitlist/withdraw/promote logic    │
   │  src/lib/auction.ts   — nomination order, bid validation, turn adv │
   │  src/lib/schedule.ts  — round-robin generator (pluggable strategy) │
   │  src/lib/scoring.ts   — set/match completion, standings recompute  │
   │  src/lib/bracket.ts   — seed top-N standings into bracket_slots    │
   └───────────────────────────────────────────────────────────────────┘
                                    │
                       Browser (admin / organizer / captain / player)
              cookie session + short-poll fetch for live auction & live score
```

**Why D1 here vs. the KV-only reports viewer this is patterned after:** that app was read-only static
report JSON — no relations, no writes at request time. This app is inherently relational (rosters,
matches, sets, standings) and write-heavy during the auction and live scoring — exactly D1's use
case, and it's free-tier (5GB, generous read/write limits for a rec league's traffic).

**Real-time strategy (v1 = polling, not WebSockets):**
- Live auction screen and live scoreboard **poll a lightweight JSON endpoint every 2–3s**
  (`/api/tournaments/[id]/auction/state`, `/api/matches/[id]/live`) while the resource is `live`;
  stop polling once status flips to `complete`/`completed`.
- This avoids Durable Objects entirely for v1 and stays on the free tier. **Deferred upgrade:** a
  Durable Object per live match/auction broadcasting over WebSocket, swapped in without changing the
  UI contract, if 2–3s latency ever feels too slow for a live in-gym crowd.

**Why KV also holds a live-score cache:** during a live match, the scorer's `PATCH` and every
viewer's poll would otherwise all hit D1 every 2–3s. Writing a denormalized JSON snapshot to KV on
every score update and having the poll endpoint read KV first (falling back to D1) keeps D1 write
volume sane without adding infrastructure.

---

## 4. Auth / roles / access model

Same signed-cookie pattern as the reference app, backed by D1 users instead of KV user records:

1. **Register:** name + email + password (or magic link — pick one at build time) creates a `users`
   row scoped to a `community_id` (join by community invite code/slug, e.g. `estancia`). Default
   role `player`. `super_admin` is a community-wide `users.role`, granted by an existing Super Admin
   (bootstrap: the community creator).
2. **Login:** verify credentials → issue **HMAC-signed httpOnly session cookie**
   `{userId, communityId, role, exp}`; mirror into KV `session:<token>` for fast revocation
   (logout / an admin disabling the user invalidates the KV entry; cookie alone would keep working
   until expiry otherwise).
3. **Guard:** proxy/middleware verifies the cookie signature on every `/app/**` route — no DB hit
   needed for basic auth; role-gated routes additionally check `role` (Super Admin) or run the
   per-tournament Organizer lookup below.
4. **Derived roles per tournament (not stored on `users`):**
   - **Organizer** = `SELECT 1 FROM tournament_organizers WHERE tournament_id=? AND user_id=?`. A
     Super Admin assigns/removes rows here per tournament (`/app/admin/organizers`) — this is core
     v1, not deferred, since "Super Admin creates the tournament and staffs it with Organizers, who
     then run it" is the actual shape of the workflow. One community can have several tournaments
     running in parallel, each with its own Organizer committee.
   - **Captain** = `SELECT 1 FROM teams WHERE tournament_id=? AND captain_user_id=?`. Grants access
     to the bid panel (scoped to the positions that team still needs) on the live auction screen for
     that tournament only.
5. **Operational writes** are D1 writes behind role-gated route handlers. Super Admin: create
   tournament, assign/remove Organizers, manage community users/roles. Organizer (once assigned):
   edit tournament variables, open/close/freeze poll, select captains, categorize positions,
   run the auction, publish schedule, enter scores, configure playoffs. Super Admin can also perform
   every Organizer action on any tournament in their community (break-glass). No redeploy needed for
   any of it.

**Authorization matrix (who can do what):**

| Action | Player | Captain | Organizer | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Vote in poll | ✅ | ✅ | ✅ | ✅ |
| View schedule / standings / bracket / scores | ✅ | ✅ | ✅ | ✅ |
| View own team roster | ✅ | ✅ | ✅ | ✅ |
| Place auction bids (their team only, needed positions) | — | ✅ | — | — |
| Create tournament + assign/remove Organizers | — | — | — | ✅ |
| Edit tournament variables | — | — | ✅ | ✅ |
| Open / close / freeze poll | — | — | ✅ | ✅ |
| Select captains + name teams | — | — | ✅ | ✅ |
| Categorize players into position buckets | — | — | ✅ | ✅ |
| Start/pause/force-resolve auction | — | — | ✅ | ✅ |
| Generate / edit / publish schedule | — | — | ✅ | ✅ |
| Enter/edit live set scores | — | — | ✅ | ✅ |
| Configure playoff cutoff, generate bracket | — | — | ✅ | ✅ |
| Manage community users/roles | — | — | — | ✅ |

---

## 5. Tournament lifecycle (state machine)

```
(super admin creates tournament + assigns organizers)
                 │
                 ▼
draft ──(organizer opens poll)──▶ poll_open ──(capacity hit OR organizer freezes)──▶ poll_closed
   │                                                                                       │
   │                                                                 (committee picks captains)
   │                                                                                       ▼
   │                                                                          captains_selected
   │                                                        (committee buckets position categories)│
   │                                                                                       ▼
   │                                                                             positions_set
   │                                                                 (organizer starts auction)     │
   │                                                                                       ▼
   │                                                                               auction_live
   │                                              (every category closed / every roster full)       │
   │                                                                                       ▼
   │                                                                            auction_complete
   │                                                                (organizer publishes schedule)   │
   │                                                                                       ▼
   │                                                                         schedule_published
   │                                                                     (first match kicks off)     │
   │                                                                                       ▼
   │                                                                              in_progress
   │                                                            (group stage matches all complete)   │
   │                                                                                       ▼
   │                                                                                 playoffs
   │                                                                       (final match completes)   │
   └────────────────────────────────────────────────────────────────────────────────▶  completed
```

The UI's admin dashboard is essentially **a stepper over this state machine** — each stage's action
is a button that's only enabled when the previous stage is done, and every stage remains viewable
(read-only) once passed.

---

## 6. Routes / pages

| Route | Role | Purpose |
|---|---|---|
| `/` | public | Marketing + login/register (pick/join a community by invite code). |
| `/app` | any | Home: current tournament status stepper, "your" call-to-action (vote / view team / next match). |
| `/app/poll` | any | Vote / see confirm-or-waitlist status; withdraw. |
| `/app/teams` | any | Directory of all teams + rosters (read-only). |
| `/app/teams/mine` | any | Your team page (once formed): roster, captain, budget spent, upcoming matches. |
| `/app/auction` | captain (bid), any (watch) | Live auction board. Bid panel shown only to the on-team captain. |
| `/app/schedule` | any | Full match schedule, filter by team/day/round. |
| `/app/matches/[id]` | any | Live/finished scoreboard for one match (set-by-set). |
| `/app/standings` | any | League table; highlights the playoff cutoff line. |
| `/app/bracket` | any | Knockout bracket view. |
| `/app/profile` | any | Your info, notification prefs, password. |
| `/app/admin` | Organizer/Super Admin | Admin home: lifecycle stepper + shortcuts into each stage tool. |
| `/app/admin/tournaments/new` | Super Admin | Create a tournament: variables + initial Organizer assignment. |
| `/app/admin/organizers` | Super Admin | Assign/remove Organizers on a tournament. |
| `/app/admin/tournament` | Organizer/Super Admin | Edit tournament variables. |
| `/app/admin/poll` | Organizer/Super Admin | Open/close/freeze poll; confirmed/waitlist table; manual promote. |
| `/app/admin/captains` | Organizer/Super Admin | Pick captains from confirmed pool; name teams. |
| `/app/admin/positions` | Organizer/Super Admin | Sort remaining confirmed players into position categories. |
| `/app/admin/auction` | Organizer/Super Admin | Auction control panel: start/pause round, force-resolve stuck bids, next nominee. |
| `/app/admin/schedule` | Organizer/Super Admin | Configure days/venues/algorithm → generate/regenerate/publish schedule. |
| `/app/admin/scoring` | Organizer/Super Admin | Pick a match → live set-score entry. |
| `/app/admin/playoffs` | Organizer/Super Admin | Set playoff team count → generate bracket. |
| `/app/admin/users` | Super Admin | Manage community members/roles. |
| `/api/*` | — | Route handlers (BFF) backing all of the above. |

---

## 7. Component inventory

**Shared**
- `LifecycleStepper` — the 7-stage progress bar (poll → captains → positions → auction → schedule →
  group stage → playoffs), used on both `/app` and `/app/admin`.
- `RoleBadge` (Super Admin / Organizer / Captain / Player), `TournamentStatusBadge`,
  `MatchStatusBadge` (scheduled/live/completed pill).
- `TeamChip` (color-coded per team, used everywhere a team is referenced).

**Super Admin**
- `TournamentCreateForm` — name + core variables (max teams, team size, budget points, poll
  capacity, scoring rules, playoff cutoff).
- `OrganizerAssignment` — multi-select community members onto `tournament_organizers`, with
  remove/re-assign.

**Poll**
- `PollCapacityMeter` — confirmed/capacity progress bar.
- `PollEntryRow` — user, submitted-at, confirmed/waitlisted badge.
- `VoteButton` — join/withdraw, disabled once poll closed.

**Teams / roster**
- `TeamCard` — name, captain, budget remaining, roster list with position + sold price per player.
- `RosterSlotList` — captain slot + one labeled slot per position category (empty/pending while the
  auction hasn't reached that category yet).

**Position categorization**
- `PositionCategorizer` (organizer) — bucket board: drag (or assign-via-select) each remaining
  confirmed player into one of the `position_categories`; running count per bucket vs. `max_teams`
  target; blocks starting the auction until every bucket is exactly full.

**Auction**
- `AuctionRoundTracker` — which position category is live now, which are done, which are still
  queued (e.g. done: Setter, Spiker 1 · live: Spiker 2 · queued: Back Player 1, Back Player 2).
- `AuctionBoard` — current nominee (name + position), current high bid + bidding team, countdown,
  "sold" flash.
- `TeamBudgetRail` — every team's remaining budget + categories-filled-this-auction, live-updated;
  greys out a team once it has already won the current round's category.
- `BidPanel` (captain-only, only enabled while the captain's team still needs the live category) —
  quick-bid buttons (+5/+10) + custom amount, disabled if outbid rules violated (must exceed current
  bid, can't exceed `budget_remaining − (categories_still_needed_after_this-1)*min_bid` reserve
  check).
- `NominationQueue` — remaining players in the *current* category's nomination order (small,
  collapsed by default).
- `AuctionLog` — scrolling bid history, taggable by position category.

**Schedule**
- `ScheduleGenerator` (admin) — algorithm picker (round robin now; others deferred), venue/day/time
  inputs, preview grid before publish.
- `MatchList` / `MatchCalendar` — filterable by team/round/day.
- `MatchCard` — teams, time, venue, status badge, score if completed.

**Scoring**
- `SetScoreEntry` (admin) — big +1/-1 tap targets per team per current set, "end set"/"end match"
  controls, undo-last-point.
- `LiveScoreboard` (viewer) — current set score large, completed-sets mini-summary, live pulse
  indicator, auto-refetch while `status=live`.

**Standings / Playoffs**
- `StandingsTable` — played/won/lost/sets/points/rank, playoff-cutoff row highlight.
- `BracketView` — responsive bracket tree (stacks vertically on mobile), TBD slots vs seeded teams,
  click-through to each bracket match's scoreboard.

---

## 8. Milestones / phases (Done-When checklists)

### Phase 0 — Foundation
- [ ] Scaffold Next.js + OpenNext Cloudflare Workers app (mirror `aiqtrader-next-js` tooling:
      `wrangler.jsonc`, `open-next.config.ts`, Tailwind v4).
- [ ] Provision D1 database + `KV` namespace bindings; write the §2 schema as D1 migrations.
- [ ] TypeScript types mirroring §2 in `src/lib/types.ts`.
- [ ] Seed script: one demo community ("Estancia"), ~40 demo users, for local dev.

### Phase 1 — Auth + community registration
- [ ] Register/login (`/`), session cookie + KV session cache, `src/proxy.ts` route guard.
- [ ] `/app` home shell + `LifecycleStepper` wired to `tournaments.status`.
- **Done when:** a new user can register into "Estancia", log in, and land on `/app`.

### Phase 2 — Tournament setup + poll
- [ ] `/app/admin/tournaments/new` (Super Admin) create tournament variables (max_teams, team_size,
      budget_points, poll_capacity default, sets_to_win, playoff_team_count) + initial
      `/app/admin/organizers` assignment (`tournament_organizers` rows).
- [ ] `/app/admin/tournament` (Organizer) edit variables post-creation.
- [ ] `/app/admin/poll` open/close/freeze; `/app/poll` vote/withdraw with confirm-vs-waitlist logic
      and FIFO promotion on withdrawal (§2).
- **Done when:** a Super Admin creates a tournament and assigns two Organizers; an Organizer (not the
      Super Admin) can open a poll with capacity 36; 40 users voting yields exactly 36 confirmed + 4
      waitlisted, in submission order.

### Phase 3 — Captains + position categorization + live auction
- [ ] `/app/admin/captains` select captains from confirmed pool, name teams, seed `auction_players`
      for every remaining confirmed player (`position_category_id = null`).
- [ ] `/app/admin/positions` bucket UI: assign each `auction_players` row to a `position_category`;
      validate every bucket ends at exactly `max_teams` before allowing auction start.
- [ ] Auction engine (`src/lib/auction.ts`): **round-scoped by position category** — nomination
      rotation within the current category, bid validation (budget + reserve check across remaining
      categories), category-complete detection advances `auction_state.current_round_index`,
      sold/unsold resolution.
- [ ] `/app/admin/auction` control panel + `/app/auction` live board with 2–3s polling; both show the
      `AuctionRoundTracker` (done/live/queued categories).
- **Done when:** running the auction end-to-end fills every team with exactly one player per position
      category (roster = captain + one Setter + one Spiker 1 + one Spiker 2 + one Back Player 1 + one
      Back Player 2), the categories close in order, and no captain's `budget_remaining` goes negative.

### Phase 4 — Scheduling
- [ ] `src/lib/schedule.ts` round-robin generator (single or double round robin, configurable).
- [ ] `/app/admin/schedule` day/venue/time-slot inputs → preview → publish (writes `matches`).
- [ ] `/app/schedule` public filterable view.
- **Done when:** generating a schedule for 6 teams produces the correct number of round-robin matches
      with no team double-booked in the same slot.

### Phase 5 — Live scoring + standings
- [ ] `src/lib/scoring.ts`: set completion rule (first to `points_per_set`, win by `win_by`), match
      completion rule (first to `sets_to_win`), standings recompute on every match completion.
- [ ] `/app/admin/scoring` live entry; KV live-snapshot cache; `/app/matches/[id]` polling viewer.
- [ ] `/app/standings` table with tie-break order from §2.
- **Done when:** entering set scores for a match updates the live scoreboard within one poll cycle
      and flips `standings` correctly on completion.

### Phase 6 — Playoffs
- [ ] `/app/admin/playoffs` set `playoff_team_count`, seed `bracket_slots` from `standings` rank.
- [ ] `/app/bracket` view; winner of a bracket match auto-advances the slot (reuse Phase 5 scoring).
- **Done when:** completing all group matches and generating a 4-team bracket correctly seeds
      1v4/2v3 and advances winners into the final slot.

### Phase 7 — Polish & deploy
- [ ] Mobile-first pass on every screen (this is a gym/sideline app — most traffic is phones).
- [ ] Empty states (no poll yet, auction not started, no matches scheduled) on every participant page.
- [ ] `npx tsc --noEmit`, `npm run build`, `npm run preview` (OpenNext local Worker) all green.
- [ ] `opennextjs-cloudflare deploy`.

---

## 9. Verify before "done"
- `npx tsc --noEmit` clean.
- `npm run build` (Next) and `npm run preview` (OpenNext local Worker) green.
- Poll confirmation, auction budget math, and standings tie-break each have a unit test with a hand-
  checked expected result (these are the three places a silent off-by-one directly produces a wrong,
  visible outcome — who's confirmed, whether a captain overspent, who's seeded #1).

---

## 10. Static HTML mockups (delivered in `/mockups`)

Self-contained Bootstrap 5 pages loading a shared in-browser mock dataset (`assets/sample-data.js`) —
no build step, open `mockups/index.html` directly in a browser. Every page is responsive
(mobile/tablet/desktop via Bootstrap's grid + a mobile-first pass) since most real usage is on a
phone at the gym. A **demo role switcher** in the nav (top right) lets you preview the same pages as
Super Admin / Organizer / Captain / Player without a real login, since role visibility is a core part
of the UX to review.

| File | Screen |
|---|---|
| `index.html` | Landing + login/register (join a community by invite code). |
| `home.html` | `/app` — lifecycle stepper + "your next action" + quick links. |
| `poll.html` | Vote to join, confirmed/waitlisted status, capacity meter. |
| `teams.html` | All-teams directory with rosters. |
| `my-team.html` | Your team's roster (by position), budget spent, upcoming matches. |
| `auction.html` | Live position-round auction board (nominee, bids, team budgets, log) + captain bid panel. |
| `schedule.html` | Full match schedule, filterable by team/day/round. |
| `scoreboard.html` | Live/finished match view, set-by-set score. |
| `standings.html` | League table with playoff-cutoff highlight. |
| `bracket.html` | Knockout bracket. |
| `profile.html` | Your info + notification prefs. |
| `admin-home.html` | Admin lifecycle stepper + shortcuts into each admin tool. |
| `admin-tournaments-new.html` | Super Admin: create a tournament (variables) + assign Organizers. |
| `admin-organizers.html` | Super Admin: manage the Organizer committee on a tournament. |
| `admin-tournament.html` | Organizer: edit tournament variables. |
| `admin-poll.html` | Open/close/freeze poll; confirmed/waitlist management table. |
| `admin-captains.html` | Pick captains, name teams. |
| `admin-positions.html` | Bucket remaining confirmed players into position categories. |
| `admin-auction.html` | Auction control panel (round tracker, start/pause/force-resolve/next nominee). |
| `admin-schedule.html` | Schedule generator (algorithm, venues, days) + preview grid. |
| `admin-scoring.html` | Live set-score entry console. |
| `admin-playoffs.html` | Playoff cutoff config + bracket generation. |
| `admin-users.html` | Community member/role management (Super Admin). |
| `assets/app.css` | Theme (CSS vars, light default + dark), team-color chips, status badges. |
| `assets/app.js` | Shared nav (role-aware), demo role switcher, mock data access, formatters. |
| `assets/sample-data.js` | Mock community/tournament/users/teams/positions/auction/matches/standings/bracket. |

These are **UX truth, not production code** — same data contract, same lifecycle language, same
role-visibility rules as §4/§6 — so the Phase 1–6 components port directly from markup to React.
