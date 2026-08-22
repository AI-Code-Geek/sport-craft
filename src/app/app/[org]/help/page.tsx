"use client";

import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/api-client";
import { Card } from "@/components/ui";

type RoleCtx = { isSuperAdmin: boolean; isOrgAdmin: boolean; canManage: boolean; captainTeamId: string | null };

export default function HelpPage() {
	const [role, setRole] = useState<RoleCtx | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		fetchMe().then(({ data }) => {
			setRole(data.roleContext ?? null);
			setLoaded(true);
		});
	}, []);

	if (!loaded) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

	const isCaptain = !!role?.captainTeamId;
	const canManage = role?.canManage ?? false;
	const isSuperAdmin = role?.isSuperAdmin ?? false;

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-xl font-bold">Help</h1>
				<p className="text-sm text-muted">What&apos;s shown here depends on your role{isSuperAdmin ? " (Super Admin)" : canManage ? " (Org Admin)" : isCaptain ? " (Captain)" : " (Player)"}.</p>
			</div>

			<Card title="Everyone — how a season runs">
				<div className="flex flex-col gap-2 text-sm">
					<p>A tournament moves through one lifecycle, in order:</p>
					<p className="font-semibold">Poll → Captains → Positions → Auction → Schedule → Live scoring → Standings / Playoffs</p>
					<p className="text-muted">
						<strong>Home</strong> always shows a "your next action" card for wherever things currently stand —
						vote in the poll, check your waitlist spot, watch a live match, or just see the schedule — plus a
						champion banner once playoffs finish, who your org's <strong>Organizers</strong> are, a
						<strong> Tournaments</strong> card linking into past seasons, and the org-wide <strong>Live
						channel</strong>.
					</p>
				</div>
			</Card>

			<Card title="Player guide">
				<div className="flex flex-col gap-3 text-sm">
					<HelpItem title="Poll">
						Vote to join while the poll is open. The first N signups (N = capacity) are confirmed;
						everyone after that waitlists. If a confirmed player withdraws, the oldest waitlisted person
						is promoted automatically. You can withdraw your own entry any time before the poll closes.
					</HelpItem>
					<HelpItem title="Teams & My Team">
						<strong>Teams</strong> is a read-only directory of every team once captains are picked.
						<strong> My Team</strong> shows your own roster, captain, position, and upcoming matches once
						the auction has placed you on one.
					</HelpItem>
					<HelpItem title="Auction">
						Watch the live position-based auction — current nominee, high bid, every team's remaining
						budget. Team captains get a bid panel while their team still needs the category up for bid.
					</HelpItem>
					<HelpItem title="Schedule & live matches">
						Full match schedule, filterable by team/day/round. A one-set match shows its raw point score;
						a multi-set match shows sets won plus every set's score in a separate column. Click into any
						match for a live scoreboard that auto-refreshes while it's in progress.
					</HelpItem>
					<HelpItem title="Standings & Bracket">
						Recomputes automatically the moment a match finishes. Ties break in order: league points
						(the Org Admin sets how many a win is worth — 2 by default) → set ratio → head-to-head →
						point differential. The bracket shows up here once the Org Admin generates it from standings.
					</HelpItem>
					<HelpItem title="Archive">
						Every completed tournament your org has run, newest first — click into one for its final
						standings, full playoff bracket, and champion.
					</HelpItem>
					<HelpItem title="Live channel">
						A public chat on the home page — any active member can read or post, shared across the whole
						org (not scoped to one tournament or team).
					</HelpItem>
					<HelpItem title="Notifications">
						The bell icon shows updates for the active tournament — poll opened, captains picked, auction
						started, schedule published, and so on.
					</HelpItem>
				</div>
			</Card>

			{isCaptain ? (
				<Card title="As a team captain" className="border-warn/40">
					<div className="flex flex-col gap-2 text-sm">
						<p>Everything above, plus:</p>
						<ul className="list-inside list-disc text-muted">
							<li>A <strong>bid panel</strong> on the Auction page while your team still needs the position category currently up for bid — quick +5/+10 buttons or a custom amount, spent from your fixed budget.</li>
							<li>Your team's roster fills in on <strong>My Team</strong> as you win auction picks.</li>
						</ul>
					</div>
				</Card>
			) : null}

			{canManage ? (
				<Card title="Org Admin guide" className="border-brand/40">
					<div className="flex flex-col gap-3 text-sm">
						<HelpItem title="1. Create a tournament">
							Set the core variables (team count, roster size, auction budget, scoring rules, playoff
							cutoff). This immediately becomes your org's active tournament — every participant page
							reflects it right away. You can run more than one per org; the most recently created is
							what participants see.
						</HelpItem>
						<HelpItem title="2. Poll">
							Open it to let players sign up, freeze it to pause new joins without closing, or close it
							to move on. You can manually promote a specific waitlisted person out of order.
						</HelpItem>
						<HelpItem title="3. Captains">
							Name each team and pick a color, then pick a captain for each from the confirmed pool.
							Each captain gets a fixed auction budget.
						</HelpItem>
						<HelpItem title="4. Positions">
							Every remaining confirmed player is auto-sorted into one category per remaining roster
							slot — rebalance until every category shows the right count, then start the auction.
						</HelpItem>
						<HelpItem title="5. Auction">
							Runs one category at a time. Mark sold (accepts the high bid, or auto-assigns to the
							lowest-budget eligible team if nobody bid), skip a nominee, or pause/resume.
						</HelpItem>
						<HelpItem title="6. Schedule">
							Pick venue(s), courts, a start time, each match's duration, a start date, days between
							rounds, and league points per win, then generate — match times fill your courts
							automatically. Every row gets an <strong>Edit</strong> button (adjust one match's
							time/court without regenerating everything) and an action button into Live Scoring.
							Re-generating replaces the whole schedule, so any in-progress live match goes with it.
						</HelpItem>
						<HelpItem title="7. Live scoring">
							Pick a match, enter points set-by-set — the first point moves it from scheduled to live
							if you haven't already hit "Start match". <strong>End match</strong> asks for
							confirmation and finalizes whichever set is still in progress. Made a mistake? Select the
							finished match (tagged "FINAL") and hit <strong>Reopen match</strong> to fix the score,
							then end it again.
						</HelpItem>
						<HelpItem title="8. Playoffs">
							Once the group stage is done, set how many teams advance (2, 4, or 8) and generate the
							bracket, seeded from current standings.
						</HelpItem>
						<HelpItem title="Org Settings & Users">
							Toggle which features your org uses, regenerate the invite code, approve/reject pending
							join requests, and promote/suspend members.
						</HelpItem>
					</div>
				</Card>
			) : null}

			{isSuperAdmin ? (
				<Card title="Super Admin guide" className="border-bad/40">
					<div className="flex flex-col gap-3 text-sm">
						<p className="text-muted">
							Super Admin is platform-level — you oversee org creation across the whole deployment, not
							the day-to-day of any single org (that's the Org Admin's job, above).
						</p>
						<HelpItem title="Organizations console">
							Review pending "create my org" requests — approve to create the org and make the
							requester its founding Org Admin, or reject to discard it. See every org on the platform
							with its member count, current Org Admin(s), and invite code. You can also create an org
							directly, skipping the request queue (it won't have an Org Admin assigned automatically —
							promote someone from that org's Users page once they've joined).
						</HelpItem>
						<HelpItem title="Your own org's admin console">
							If your account also holds an active Org Admin membership somewhere, you'll see the
							regular admin console for whichever org is active in your session, same as any Org Admin.
						</HelpItem>
					</div>
				</Card>
			) : null}
		</div>
	);
}

function HelpItem({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="mb-0.5 font-semibold">{title}</div>
			<p className="text-muted">{children}</p>
		</div>
	);
}
