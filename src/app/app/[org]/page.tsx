"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMe, getTournament, getPoll, getTeams, getSchedule, getBracket, listTournaments, getOrganizers } from "@/lib/api-client";
import type { PollEntryView } from "@/lib/api-client";
import { Card, LifecycleStepper, TeamChip } from "@/components/ui";
import { LiveChannel } from "@/components/LiveChannel";
import { tournamentStatusLabel } from "@/lib/format";
import type { Tournament, Team, Match } from "@/lib/types";

type Phase = "loading" | "no-tournament" | "ready";

export default function OrgHomePage() {
	const { org } = useParams<{ org: string }>();
	const [phase, setPhase] = useState<Phase>("loading");
	const [tournament, setTournament] = useState<Tournament | null>(null);
	const [role, setRole] = useState<{ isSuperAdmin: boolean; isOrgAdmin: boolean; canManage: boolean; captainTeamId: string | null } | null>(null);
	const [myEntry, setMyEntry] = useState<PollEntryView | null>(null);
	const [pollFrozen, setPollFrozen] = useState(false);
	const [myTeam, setMyTeam] = useState<Team | null>(null);
	const [teams, setTeams] = useState<Team[]>([]);
	const [liveMatch, setLiveMatch] = useState<Match | null>(null);
	const [champion, setChampion] = useState<Team | null>(null);
	const [recentTournaments, setRecentTournaments] = useState<Tournament[]>([]);
	const [organizers, setOrganizers] = useState<{ userid: string; name: string }[]>([]);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.user) return;
			if (!data.tournamentId) {
				setRole(data.roleContext ?? null);
				setPhase("no-tournament");
				return;
			}
			setRole(data.roleContext ?? null);

			const [{ data: t }, { data: p }, { data: teams }, { data: sched }, { data: br }, { data: allT }, { data: org }] = await Promise.all([
				getTournament(data.tournamentId),
				getPoll(data.tournamentId),
				getTeams(data.tournamentId),
				getSchedule(data.tournamentId),
				getBracket(data.tournamentId),
				listTournaments(),
				getOrganizers(),
			]);
			setRecentTournaments((allT.tournaments ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5));
			setOrganizers(org.organizers ?? []);
			setTournament(t.tournament ?? null);
			setMyEntry(p.poll?.entries.find((e) => e.userId === data.user!.userid) ?? null);
			setPollFrozen(p.poll?.frozen ?? false);
			setTeams(teams.teams ?? []);
			setMyTeam(teams.teams?.find((tm) => tm.roster.some((r) => r.userId === data.user!.userid)) ?? null);
			setLiveMatch(sched.matches?.find((m) => m.status === "live") ?? null);
			if (t.tournament?.status === "completed" && br.bracket) {
				const finalRound = br.bracket.rounds[br.bracket.rounds.length - 1];
				const finalMatchId = finalRound?.matches[0]?.matchId;
				const finalMatch = finalMatchId ? sched.matches?.find((m) => m.id === finalMatchId) : null;
				const championId = finalMatch?.winnerTeamId ?? null;
				setChampion(championId ? teams.teams?.find((tm) => tm.id === championId) ?? null : null);
			}
			setPhase("ready");
		});
	}, []);

	if (phase === "loading") {
		return (
			<Card>
				<p className="text-sm text-muted">Loading…</p>
			</Card>
		);
	}

	if (phase === "no-tournament") {
		const canManage = role?.canManage ?? false;
		return (
			<Card>
				<p className="text-sm text-muted">
					No tournament yet.{" "}
					{canManage ? (
						<Link href={`/app/${org}/admin/tournaments/new`} className="text-brand">Create one to get started →</Link>
					) : (
						"Ask your Org Admin to create one."
					)}
				</p>
			</Card>
		);
	}

	if (!tournament) {
		return (
			<Card>
				<p className="text-sm text-muted">Loading…</p>
			</Card>
		);
	}

	const canManage = role?.canManage ?? false;
	const isCaptain = role?.captainTeamId != null;

	// A tournament in "draft" (poll not opened yet) is only visible to whoever's building it — everyone
	// else sees the same "nothing to see yet" state as before it existed, not its name/status/stepper.
	if (!canManage && tournament.status === "draft") {
		return (
			<Card>
				<p className="text-sm text-muted">No tournament open yet. Check back once your Org Admin opens signup.</p>
			</Card>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h1 className="text-xl font-bold">{tournament.name}</h1>
				</div>
				<span className="rounded-md bg-ok/15 px-2 py-1 text-xs font-bold text-ok uppercase">
					{tournamentStatusLabel(tournament.status, pollFrozen)}
				</span>
			</div>

			<Card title="Tournament progress">
				<LifecycleStepper status={tournament.status} pollFrozen={pollFrozen} />
			</Card>

			{tournament.guidelines ? (
				<Card title="Rules & guidelines">
					<p className="whitespace-pre-wrap text-sm">{tournament.guidelines}</p>
				</Card>
			) : null}

			{champion ? (
				<Card>
					<div className="flex flex-col items-center gap-2 py-4 text-center">
						<div className="text-3xl">🏆</div>
						<div className="text-xs font-semibold tracking-wide text-muted uppercase">Tournament complete — Champion</div>
						<TeamChip id={champion.id} name={champion.name} color={champion.color} link={false} />
					</div>
				</Card>
			) : null}

			{liveMatch ? (
				<Card>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-sm">
							<span className="mr-1 inline-block h-2 w-2 rounded-full bg-bad align-middle live-pulse" /> Live now:{" "}
							<strong>{teams.find((t) => t.id === liveMatch.teamAId)?.name ?? "TBD"}</strong> vs{" "}
							<strong>{teams.find((t) => t.id === liveMatch.teamBId)?.name ?? "TBD"}</strong>
						</p>
						<Link href={`/app/${org}/matches/${liveMatch.id}`} className="btn-danger w-fit">Watch live →</Link>
					</div>
				</Card>
			) : null}

			<div className="grid gap-4 md:grid-cols-2">
				<Card title="Your next action">
					{canManage ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">You&apos;re running this tournament as {role?.isSuperAdmin ? "Super Admin" : "Org Admin"}. Jump into the admin console to advance the next stage.</p>
							<Link href={`/app/${org}/admin`} className="btn-primary w-fit">Open admin console →</Link>
						</div>
					) : tournament.status.startsWith("poll") && pollFrozen && (!myEntry || myEntry.status === "withdrawn") ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">Signups are paused right now — check back soon.</p>
						</div>
					) : tournament.status.startsWith("poll") && (!myEntry || myEntry.status === "withdrawn") ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">The poll is open — grab one of the remaining spots before it fills up.</p>
							<Link href={`/app/${org}/poll`} className="btn-primary w-fit">Vote in the poll →</Link>
						</div>
					) : myEntry && myEntry.status !== "withdrawn" && !myTeam ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">
								You&apos;re on the roster pool: <StatusPill status={myEntry.status} />
							</p>
							<Link href={`/app/${org}/poll`} className="btn-secondary w-fit">View poll status →</Link>
						</div>
					) : liveMatch ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">
								<span className="mr-1 inline-block h-2 w-2 rounded-full bg-bad align-middle live-pulse" /> A match is live right now.
							</p>
							<Link href={`/app/${org}/matches/${liveMatch.id}`} className="btn-danger w-fit">Watch live →</Link>
						</div>
					) : tournament.status === "completed" ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm">This tournament is complete — check out the final bracket and standings.</p>
							<Link href={`/app/${org}/bracket`} className="btn-secondary w-fit">View bracket →</Link>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<p className="text-sm">Check the schedule for your team&apos;s next match.</p>
							<Link href={`/app/${org}/schedule`} className="btn-secondary w-fit">View schedule →</Link>
						</div>
					)}
					{isCaptain ? (
						<div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
							<p className="text-sm">The live auction may need your bids for open roster positions.</p>
							<Link href={`/app/${org}/auction`} className="btn-warn w-fit">Go to auction →</Link>
						</div>
					) : null}
				</Card>

				<Card title="Your team">
					{myTeam ? (
						<div className="flex flex-col gap-2">
							<TeamChip id={myTeam.id} name={myTeam.name} color={myTeam.color} link={false} />
							<div className="text-sm text-muted">Roster: {myTeam.roster.length}/{tournament.teamSize}</div>
							<Link href={`/app/${org}/teams/mine`} className="btn-secondary w-fit">View roster →</Link>
						</div>
					) : (
						<p className="text-sm text-muted">You&apos;re not on a team yet — teams form after the poll closes and captains run the auction.</p>
					)}
				</Card>
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<QuickLink href={`/app/${org}/schedule`} icon="🗓️" label="Schedule" />
				<QuickLink href={`/app/${org}/standings`} icon="📊" label="Standings" />
				<QuickLink href={`/app/${org}/bracket`} icon="🏆" label="Bracket" />
				<QuickLink href={`/app/${org}/teams`} icon="👥" label="All Teams" />
			</div>

			<LiveChannel />

			<div className="grid gap-4 md:grid-cols-2">
				<Card title="Tournaments">
					{recentTournaments.length === 0 ? (
						<p className="text-sm text-muted">No tournaments yet.</p>
					) : (
						<div className="flex flex-col gap-2">
							{recentTournaments.map((rt) => {
								const isCurrent = rt.id === tournament.id;
								const content = (
									<div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
										<span className="truncate">{rt.name}</span>
										<span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${rt.status === "completed" ? "bg-ok/15 text-ok" : "bg-brand/15 text-brand"}`}>
											{isCurrent ? "current" : rt.status.replace(/_/g, " ")}
										</span>
									</div>
								);
								return rt.status === "completed" && !isCurrent ? (
									<Link key={rt.id} href={`/app/${org}/archive/${rt.id}`} className="hover:opacity-80">{content}</Link>
								) : (
									<div key={rt.id}>{content}</div>
								);
							})}
							<Link href={`/app/${org}/archive`} className="mt-1 text-xs text-brand">See full archive →</Link>
						</div>
					)}
				</Card>

				<Card title="Organizers">
					{organizers.length === 0 ? (
						<p className="text-sm text-muted">No organizers listed.</p>
					) : (
						<div className="flex flex-col gap-2">
							{organizers.map((o) => (
								<div key={o.userid} className="flex items-center gap-2 text-sm">
									<span className="flex h-7 w-7 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-xs font-semibold text-brand">
										{o.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
									</span>
									{o.name}
								</div>
							))}
						</div>
					)}
				</Card>
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
