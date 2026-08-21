# Super Admin guide

Super Admin is a **platform-level** role, separate from any one org — you oversee org creation across
the whole deployment, not the day-to-day running of any single org's tournaments (that's the Org
Admin's job, [`03-org-admin-guide.md`](./03-org-admin-guide.md)).

There's no self-service way to become Super Admin — it's granted by whoever controls the deployment,
by hand-writing your account record. See
[`docs/developer/05-deployment.md`](../developer/05-deployment.md) if you're setting up the very first
one.

## Organizations console — `/app/admin/organizations`

Your main screen. Three sections:

- **Pending requests** — every "create my org" submission awaiting a decision. Each shows the
  requested name, sport, and which features they asked for. **Approve** to create the org and make the
  requester its founding Org Admin; **reject** to discard it (nothing gets created).
- **All organizations** — every org on the platform, with its active member count, current Org
  Admin(s), and invite code at a glance.
- **Decided requests** — a log of everything already approved or rejected, for reference.

You can also **create an org directly** from this screen, skipping the request queue — useful for
setting one up yourself rather than waiting on a request, though note it won't have an Org Admin
assigned automatically the way an approved request does; you'd promote someone to Org Admin from that
org's Users page once they've joined.

## What you *don't* need to do

You don't manage any individual org's tournaments, poll, auction, schedule, or members directly — those
are the Org Admin's tools. If you want to help run one org's day-to-day, the practical path is: join
that org (or have its Org Admin promote you), which gives you an active membership there, and use its
admin console like an Org Admin would.

## Admin console for your own org

If your Super Admin account also happens to hold an active Org Admin membership somewhere (e.g. the
seeded demo account is both), you'll see the regular admin console (`/app/admin`) for whichever org is
currently active in your session — same as any Org Admin, described in
[`03-org-admin-guide.md`](./03-org-admin-guide.md).
