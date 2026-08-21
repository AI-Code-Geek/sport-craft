"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchMe, getMatch, getSchedule, getTeams } from "@/lib/api-client";
import { Card, TeamChip, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match } from "@/lib/types";

type TeamView = Awaited<ReturnType<typeof getTeams>>["data"]["teams"][number];

export default function ScoreboardPage() {
	const { matchId } = useParams<{ matchId: string }>();
	const router = useRouter();
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [match, setMatch] = useState<Match | null>(null);
	const [allMatches, setAllMatches] = useState<Match[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			const [{ data: sched }, { data: t }] = await Promise.all([getSchedule(data.tournamentId), getTeams(data.tournamentId)]);
			setAllMatches(sched.matches ?? []);
			setTeams(t.teams ?? []);
		});
	}, []);

	useEffect(() => {
		if (!tournamentId || !matchId) return;
		let cancelled = false;
		async function load() {
			const { data } = await getMatch(tournamentId!, matchId);
			if (!cancelled) setMatch(data.match ?? null);
		}
		load();
		if (pollRef.current) clearInterval(pollRef.current);
		pollRef.current = setInterval(load, 3000);
		return () => {
			cancelled = true;
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [tournamentId, matchId]);

	const teamOf = new Map(teams.map((t) => [t.id, t]));

	if (!match) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

	const a = teamOf.get(match.teamAId);
	const b = teamOf.get(match.teamBId);
	const setsA = match.sets.filter((s) => s.status === "completed" && s.a > s.b).length;
	const setsB = match.sets.filter((s) => s.status === "completed" && s.b > s.a).length;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Scoreboard</h1>
				<select
					className="input w-auto"
					value={matchId}
					onChange={(e) => router.push(`/app/matches/${e.target.value}`)}
				>
					{allMatches
						.slice()
						.sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))
						.map((m) => (
							<option key={m.id} value={m.id}>
								{teamOf.get(m.teamAId)?.name ?? m.teamAId} vs {teamOf.get(m.teamBId)?.name ?? m.teamBId} — {fmtDateTime(m.scheduledAt)}
							</option>
						))}
				</select>
			</div>

			<Card>
				<div className="flex flex-col items-center gap-3 py-4 text-center">
					<div className="flex items-center gap-2">
						<StatusBadge status={match.status} />
						<span className="text-xs text-muted">{match.round} · {fmtDateTime(match.scheduledAt)} · {match.venue} {match.court}</span>
					</div>
					<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
						<div className="text-right text-lg">{a ? <TeamChip id={a.id} name={a.name} color={a.color} link={false} /> : match.teamAId}</div>
						<div>
							<div className="mono text-4xl font-black">{setsA}–{setsB}</div>
							<div className="text-xs text-muted">sets</div>
						</div>
						<div className="text-left text-lg">{b ? <TeamChip id={b.id} name={b.name} color={b.color} link={false} /> : match.teamBId}</div>
					</div>
				</div>
			</Card>

			<Card title="Set-by-set">
				<div className="flex flex-wrap justify-center gap-6">
					{match.sets.map((s) => (
						<div key={s.setNumber} className="text-center">
							<div className="mb-1 text-xs text-muted">Set {s.setNumber}</div>
							<div className={`mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-lg font-bold ${s.status === "completed" && s.a > s.b ? "bg-ok/15 text-ok" : "bg-surface-2"}`}>{s.a}</div>
							<div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg font-bold ${s.status === "completed" && s.b > s.a ? "bg-ok/15 text-ok" : "bg-surface-2"}`}>{s.b}</div>
							{s.status === "in_progress" ? <div className="mt-1 text-xs text-bad">live</div> : null}
						</div>
					))}
					{match.sets.length === 0 ? <span className="text-sm text-muted">Not started yet.</span> : null}
				</div>
			</Card>
			{match.status === "live" ? <p className="text-center text-xs text-muted">Live scores refresh automatically every few seconds.</p> : null}
		</div>
	);
}
