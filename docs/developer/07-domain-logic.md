# Domain logic reference

The exact rules behind the four places a silent off-by-one would produce a wrong, *visible* result:
who's confirmed, whether a captain overspent, who wins a tie-break, and how the bracket seeds. Each
section names the source file — read that file for the literal implementation.

## Poll confirmation (`src/lib/poll-store.ts`)

- **Rule:** the first `capacity` entries with status `confirmed`, ordered by `submittedAt`, are
  confirmed; everyone after that is `waitlisted`. Capacity defaults to `maxTeams * teamSize` but is
  editable per tournament.
- **Join:** `confirmedCount(poll) < poll.capacity` → `confirmed`, else `waitlisted`. Re-joining after a
  withdrawal re-evaluates against current capacity (you might land confirmed even if you waitlisted the
  first time, if spots opened up).
- **Withdraw:** if the withdrawn entry was `confirmed`, the **oldest** `waitlisted` entry (by
  `submittedAt`) is promoted — strict FIFO, not just "next in the list".
- **Manual promote** (`promoteEntry`, Org Admin only) bypasses FIFO order entirely — an explicit
  override, not a bug if it doesn't pick the oldest waitlisted entry.
- Joining/withdrawing while `poll.frozen` is `true` throws `poll_frozen` — freezing (or closing, which
  also freezes) is a hard stop, not just a UI hint.

## Live auction (`src/lib/auction-store.ts`)

One **position category** is auctioned at a time — every player assigned to that category is nominated
in turn; once every player in it is sold, the next category opens (`roundOrder`, `currentRoundIndex`).

- **Bid validity:** `amount >= (currentBid?.amount ?? 0) + 1` (strictly higher, minimum increment 1)
  **and** `amount <= team.budgetRemaining - reserve`, where `reserve` = 1 point for every *remaining*
  category (after this one) the team still needs. This is what stops a team from blowing its whole
  budget on one category and being unable to afford a minimum bid later.
- **`teamNeedsCategory`**: a team "needs" a category iff it has no roster entry with that `position` yet
  — this is re-derived from the roster every time, never cached, so it can't drift.
- **Resolving with no bids:** auto-assigns to the *eligible* team (still needs the category, has ≥1
  point) with the **least** remaining budget, at 1 point. This exists specifically so a team can't
  stall the whole auction by simply never bidding — someone always wins the nominee.
- **Skip:** only allowed when there's no active bid (`cannot_skip_with_active_bid`) — sends the nominee
  to the back of the *current* round's queue, doesn't remove them.
- Auction completes (`status: "complete"`, tournament → `auction_complete`) once every category's queue
  is exhausted — there's no separate "are all rosters full" check; category-completeness *is* the
  completeness check, since categories are sized to exactly fill every roster slot.

## Schedule generation (`src/lib/match-store.ts`)

Single round-robin (`roundRobinRounds`) over team ids, then slotted onto court/time:

```
slotFor(k) = { court: courts[k % courts.length], time: times[floor(k / courts.length) % times.length] }
```

Courts fill first within a round (simultaneous matches on different courts, same time), then the next
batch of matches in that round bumps to the next time slot. This guarantees no two matches in the same
round ever share a `(court, time)` pair, **as long as** `courts.length * times.length >= roundMatchCount`
(max round size is `floor(teamCount / 2)`) — under-provisioning courts/times for the team count you
have will silently double-book a slot rather than error, so size them generously.

## Standings (`src/lib/standings.ts`)

Computed fresh from `matches` + `teams` on every read — **never persisted**, so there's no
derived-cache to go stale. Only `round: "group"` + `status: "completed"` matches count.

**Tie-break order**, each step only breaking ties left by the previous one:
1. **League points** (win = 2, loss = 0 — not currently configurable per tournament).
2. **Set ratio** (`setsWon / setsLost`; a team with zero sets lost gets a large-but-finite ratio
   `setsWon * 1000`, not `Infinity`, so multiple undefeated teams still compare sensibly against each
   other by sets won).
3. **Head-to-head** — wins against the *other specific tied team* only (not a general "quality wins"
   metric).
4. **Point differential** (`pointsFor - pointsAgainst`, summed across every set played, not just sets
   won).

## Bracket / playoffs (`src/lib/bracket-store.ts`)

- `playoffTeamCount` must be exactly **2, 4, or 8** (`SUPPORTED_PLAYOFF_COUNTS`) — a deliberate MVP cut
  so every bracket is a clean power-of-two single-elimination tree with **no byes** to reason about.
  Any other value throws `unsupported_playoff_count`.
- Round 0 seeds immediately from current standings rank (1 vs N, 2 vs N-1, ...) when generated.
- Later rounds fill in — and that round's `Match` row gets created — only once **both** of that slot's
  feeder matches have completed. There's no "TBD vs TBD" match object sitting in `matches` ahead of
  time; the bracket's `BracketSlot.matchId` stays `null` until then.

## Where these show up in the UI

Every rule above is enforced **server-side** in the route handler / store function, not just the
client form — the client-side validation (disabled buttons, inline error text) is a UX nicety, never
the actual guard. If you're debugging a "the button should be disabled but isn't" report, the real
question is always what the API returned, not what the button's `disabled` prop evaluated to.
