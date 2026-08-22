# Org Admin guide

You run one org day-to-day. You got this role either by having your **org-creation request approved**
(you're its founding Org Admin), or by being **promoted** from Player by another Org Admin.

## The admin console (`/app/admin`)

Your home base. Shows the active tournament's lifecycle stepper and a tool grid — which tools appear
depends on which features your org has enabled (Org Settings, below). A tournament's stages, roughly
in order:

**Poll → Captains → Positions → Auction → Schedule → Live scoring → Standings/Playoffs**

Each stage's page stays viewable (read-only) once you've moved past it — nothing locks you out of
looking back.

### 1. Create a tournament — `/app/admin/tournaments/new`

Name it, set the core variables (team count, roster size, auction budget, scoring rules, playoff
cutoff), and create it. This immediately becomes your org's **active** tournament — every participant
page reflects it right away. You can run more than one tournament per org (e.g. a new season) — each
gets its own poll/teams/auction/schedule, and the most recently created one is what participants see.

### 2. Poll — `/app/admin/poll`

**Open** the poll to let players sign up. Watch the confirmed/waitlist table fill up — the first N
(capacity) are auto-confirmed, everyone after that waitlists. You can **freeze** it manually (stops
new joins without formally closing) or **close** it once you're ready to move on. You can also
manually promote a specific waitlisted person out of order if needed.

### 3. Captains — `/app/admin/captains`

Two steps: **name your teams** (and pick a color for each), then **pick a captain** for each team from
the confirmed pool. Each captain gets a fixed auction budget.

### 4. Positions — `/app/admin/positions`

Every remaining confirmed player gets sorted into one category per remaining roster slot (e.g. Setter,
Spiker 1, Spiker 2, Back Player 1, Back Player 2 for a 6-player roster). They're auto-distributed as a
starting point — drag-and-drop (or use the dropdown) to rebalance until every category shows exactly
the right count, then **start the auction**.

### 5. Auction — `/app/admin/auction`

Runs one category at a time. As players are nominated, captains bid from their own login. You can
**mark sold** (accepts the current high bid, or auto-assigns to the lowest-budget eligible team if
nobody bid — so the auction never stalls), **skip** a nominee, or **pause/resume** the whole auction.

### 6. Schedule — `/app/admin/schedule`

Pick venue(s), court(s), time slot(s), a start date, and days between rounds, then **generate**. Builds
a full round-robin with no team double-booked in a slot. You can regenerate before publishing if
something looks off. Each row's **Action** column jumps straight into Live Scoring for that match —
"Start match" for a scheduled one, "Continue scoring" once it's live.

A match's scheduled time is display-only — nothing starts it automatically. It stays `scheduled`
until you actually add its first point (whether early, late, or exactly on time makes no difference).

### 7. Live scoring — `/app/admin/scoring`

Pick a match (or arrive already on one via the Schedule page's Action column), enter points set-by-set
as it happens — the first point is what moves a match from `scheduled` to `live`. Standings update
automatically the moment a match completes — no separate step.

### 8. Playoffs — `/app/admin/playoffs`

Once the group stage is done, set how many teams advance (2, 4, or 8 only) and generate the bracket —
seeded from current standings.

## Org Settings — `/app/admin/settings`

- **Name & sport** — your org's identity.
- **Features** — toggle poll / scheduler / teams / positions / auction / live scoring / brackets /
  notifications on or off. Turning one off just hides it from the nav and admin console; it doesn't
  touch any data already stored, so re-enabling it later picks up right where it left off.
- **Invite code** — what new players register against on the "Join a community" tab. You can
  **regenerate** it (invalidates the old one for anyone who hasn't registered yet).
- **Role overview** — quick counts of Org Admins, Players, suspended members, and pending join
  requests.

## Users — `/app/admin/users`

- **Pending join requests** at the top — **approve** or **reject** each one. Approving activates their
  membership immediately; rejecting removes the request entirely (they're free to request again).
- **Active members** below — promote/demote between Player and Org Admin, or suspend/unsuspend a
  member.
