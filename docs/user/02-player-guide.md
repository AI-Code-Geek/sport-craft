# Player guide

Once you're an **active** member of an org (see
[`01-getting-started.md`](./01-getting-started.md) if you're still pending approval), here's what you
can do.

## Home (`/app`)

Shows the org's current tournament and a **"your next action"** card that changes based on where
things stand: vote in the poll if it's open, check your waitlist status, jump to a live match, or
just see the schedule. If your org has more than one tournament, this is always the *most recently
created* one.

## Poll (`/app/poll`)

Vote to join the season while the poll is open. The first N people to join (N = the poll's capacity)
are **confirmed**; everyone after that is **waitlisted**. If a confirmed player withdraws, the oldest
waitlisted person is automatically promoted — first come, first served, both ways. You can withdraw
your own entry any time before the poll closes.

## Teams (`/app/teams`) & My Team (`/app/teams/mine`)

`/app/teams` is a read-only directory of every team once captains are picked. `/app/teams/mine` shows
**your** team once the auction has placed you on a roster — captain, teammates by position, budget
spent, and upcoming matches. Before that, it shows an empty state explaining what happens next.

## Auction (`/app/auction`)

Live during the position-based auction stage. Most players just **watch** — the board shows the
current nominee, the high bid, and every team's remaining budget, refreshing every few seconds. If
you're a **team captain**, you additionally get a bid panel (only while your team still needs the
category currently up for auction) with quick +5/+10 buttons or a custom amount.

## Schedule (`/app/schedule`) & live matches (`/app/matches/[id]`)

Full match schedule, filterable by team/day/round. The **Score** column shows the raw point score for
a one-set match, or the sets-won tally once a match has gone past one set — with a **Sets** column
alongside showing every set's score (e.g. "25-21, 18-25, 15-10"). Click into any match for a **live
scoreboard** (auto-refreshes while the match is in progress) or the final result once it's done.

## Standings (`/app/standings`) & Bracket (`/app/bracket`)

Standings recompute automatically every time a match finishes — no need to refresh anything by hand.
Sets won and sets lost are their own columns, alongside a point **Diff** (points for minus points
against, color-coded). Ties break in order: league points (the Org Admin sets how many a win is worth
when generating the schedule — 2 by default) → set ratio → head-to-head → point differential. Once the
group stage wraps up, the Org Admin generates the playoff bracket and it shows up here, seeded from the
standings.

## Profile (`/app/profile`)

Your name/email and role badge (Player, Captain, Org Admin, Super Admin — whichever applies).

## Notifications

The bell icon in the nav shows updates relevant to you for the active tournament (poll opened,
captains picked, auction started, schedule published, etc.) — only appears if your org has the
notifications feature enabled.

## Belonging to more than one org

If you've joined (or been approved into) more than one org, an **org picker** appears in the nav —
switching orgs takes you to that org's own home page, poll, teams, and so on. Your role can be
different in each org.
