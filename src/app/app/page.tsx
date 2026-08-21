"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMe, getTournament, getPoll, getTeams, getSchedule } from "@/lib/api-client";
import type { PollEntryView } from "@/lib/api-client";
import { Card, LifecycleStepper, TeamChip } from "@/components/ui";
import type { Tournament, Team, Match } from "@/lib/types";

export default function HomePage() {
	const [tournament, setTournament] = useState<Tournament | null>(null);
	const [role, setRole] = useState<{ isSuperAdmin: boolean; isOrganizer: boolean; canManage: boolean; captainTeamId: string | null } | null>(null);
	const [myEntry, setMyEntry] = useState<PollEntryView | null>(null);
	const [myTeam, setMyTeam] = useState<Team | null>(null);
	const [liveMatch, setLiveMatch] = useState<Match | null>(null);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.user || !data.tournamentId) return;
			setRole(data.roleContext ?? null);

			const [{ data: t }, { data: p }, { data: teams }, { data: sched }] = await Promise.all([
				getTournament(data.tournamentId),
				getPoll(data.tournamentId),
				getTeams(data.tournamentId),
				getSchedule(data.tournamentId),
			]);
			setTournament(t.tournament ?? null);
			setMyEntry(p.poll?.entries.find((e) => e.userId === data.user!.userid) ?? null);
			setMyTeam(teams.teams?.find((tm) => tm.roster.some((r) => r.userId === data.user!.userid)) ?? null);
			setLiveMatch(sched.matches?.find((m) => m.status === "live") ?? null);
		});
	}, []);

	if (!tournament) {
		return (
			<Card>
				<p className="text-sm text-muted">Loading…</p>
			</Card>
		);
	}

	const canManage = role?.canManage ?? false;
	const isCaptain = role?.captainTeamId != null;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h1 className="text-xl font-bold">{tournament.name}</h1>
				</div>
				<span className="rounded-md bg-ok/15 px-2 py-1 text-xs font-bold text-ok uppercase">{tournament.status.replace(/_/g, " ")}</span>
			</div>

			<Card title="Tournament progress">
				<LifecycleStepper status={tournament.status} />
			</Card>

			<div className="grid gap-4 md:grid-cols-2">
				<Card title="Your next action">
					{canManage ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">You&apos;re running this tournament as {role?.isSuperAdmin ? "Super Admin" : "Organizer"}. Jump into the admin console to advance the next stage.</p>
							<Link href="/app/admin" className="btn-primary w-fit">Open admin console →</Link>
						</div>
					) : tournament.status.startsWith("poll") && (!myEntry || myEntry.status === "withdrawn") ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">The poll is open — grab one of the remaining spots before it fills up.</p>
							<Link href="/app/poll" className="btn-primary w-fit">Vote in the poll →</Link>
						</div>
					) : myEntry && myEntry.status !== "withdrawn" && !myTeam ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">
								You&apos;re on the roster pool: <StatusPill status={myEntry.status} />
							</p>
							<Link href="/app/poll" className="btn-secondary w-fit">View poll status →</Link>
						</div>
					) : liveMatch ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">
								<span className="mr-1 inline-block h-2 w-2 rounded-full bg-bad align-middle live-pulse" /> A match is live right now.
							</p>
							<Link href={`/app/matches/${liveMatch.id}`} className="btn-danger w-fit">Watch live →</Link>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<p className="text-sm">Check the schedule for your team&apos;s next match.</p>
							<Link href="/app/schedule" className="btn-secondary w-fit">View schedule →</Link>
						</div>
					)}
					{isCaptain ? (
						<div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
							<p className="text-sm">The live auction may need your bids for open roster positions.</p>
							<Link href="/app/auction" className="btn-warn w-fit">Go to auction →</Link>
						</div>
					) : null}
				</Card>

				<Card title="Your team">
					{myTeam ? (
						<div className="flex flex-col gap-2">
							<TeamChip id={myTeam.id} name={myTeam.name} color={myTeam.color} link={false} />
							<div className="text-sm text-muted">Roster: {myTeam.roster.length}/{tournament.teamSize}</div>
							<Link href="/app/teams/mine" className="btn-secondary w-fit">View roster →</Link>
						</div>
					) : (
						<p className="text-sm text-muted">You&apos;re not on a team yet — teams form after the poll closes and captains run the auction.</p>
					)}
				</Card>
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<QuickLink href="/app/schedule" icon="🗓️" label="Schedule" />
				<QuickLink href="/app/standings" icon="📊" label="Standings" />
				<QuickLink href="/app/bracket" icon="🏆" label="Bracket" />
				<QuickLink href="/app/teams" icon="👥" label="All Teams" />
			</div>

		</div>
	);
}

function StatusPill({ status }: { status: string }) {
	const cls = status === "confirmed" ? "bg-ok/15 text-ok" : status === "waitlisted" ? "bg-warn/15 text-warn" : "bg-neutral/20 text-neutral";
	return <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${cls}`}>{status}</span>;
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
	return (
		<Link href={href} className="rounded-xl border border-border bg-surface p-4 text-center hover:bg-surface-2">
			<div className="text-2xl">{icon}</div>
			<div className="mt-1 text-sm">{label}</div>
		</Link>
	);
}
