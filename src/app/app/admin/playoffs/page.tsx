"use client";

import { useEffect, useState } from "react";
import { fetchMe, getStandings, getTeams, getSchedule, generateBracket, getBracket, updateTournament } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip } from "@/components/ui";
import type { StandingsRow, Bracket } from "@/lib/types";

export default function AdminPlayoffsPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [standings, setStandings] = useState<StandingsRow[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [remaining, setRemaining] = useState(0);
	const [bracket, setBracket] = useState<Bracket | null>(null);
	const [cutoff, setCutoff] = useState(4);
	const [venue, setVenue] = useState("Community Gym");
	const [court, setCourt] = useState("Center Court");
	const [error, setError] = useState("");

	async function load(tid: string) {
		const [{ data: s }, { data: t }, { data: sched }, { data: b }] = await Promise.all([
			getStandings(tid), getTeams(tid), getSchedule(tid), getBracket(tid),
		]);
		setStandings(s.standings ?? []);
		setCutoff(s.playoffTeamCount ?? 4);
		setTeams(t.teams ?? []);
		setRemaining((sched.matches ?? []).filter((m) => m.round === "group" && m.status !== "completed").length);
		setBracket(b.bracket ?? null);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
		});
	}, []);

	async function saveCutoff() {
		if (!tournamentId) return;
		await updateTournament(tournamentId, { playoffTeamCount: cutoff });
		await load(tournamentId);
	}

	async function generate() {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await generateBracket(tournamentId, { venue, court, dates: [] });
		if (!ok) return setError(data.error ?? "Could not generate the bracket.");
		await load(tournamentId);
	}

	const teamOf = new Map(teams.map((t) => [t.id, t]));

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Playoff configuration</h1>

			<div className="grid gap-4 lg:grid-cols-[320px_1fr]">
				<Card title="Cutoff">
					<div className="flex flex-col gap-3">
						<label className="flex flex-col gap-1 text-sm">
							<span className="text-xs text-muted">Teams advancing</span>
							<select className="input" value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))}>
								<option value={2}>2</option>
								<option value={4}>4</option>
								<option value={8}>8</option>
							</select>
						</label>
						<button className="btn-outline w-fit" onClick={saveCutoff}>Save cutoff</button>
						<label className="flex flex-col gap-1 text-sm">
							<span className="text-xs text-muted">Playoff venue</span>
							<input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} />
						</label>
						<label className="flex flex-col gap-1 text-sm">
							<span className="text-xs text-muted">Court</span>
							<input className="input" value={court} onChange={(e) => setCourt(e.target.value)} />
						</label>
						<p className="text-xs text-muted">
							{remaining ? `${remaining} group-stage match${remaining === 1 ? "" : "es"} still to play.` : "Group stage complete — ready to lock the bracket."}
						</p>
						{error ? <p className="text-sm text-bad">{error}</p> : null}
						<button className="btn-primary" onClick={generate}>Generate bracket →</button>
					</div>
				</Card>
				<Card title="Standings (seed order)">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="text-left text-xs text-muted">
								<tr><th className="pb-2 pr-2">Seed</th><th className="pb-2 pr-2">Team</th><th className="pb-2 pr-2 text-right">League pts</th><th className="pb-2 text-right">Sets</th></tr>
							</thead>
							<tbody>
								{standings.map((s) => {
									const team = teamOf.get(s.teamId);
									return (
										<tr key={s.teamId} className={`border-t border-border ${s.rank > cutoff ? "text-muted" : ""}`}>
											<td className="py-1.5 pr-2 mono">{s.rank}</td>
											<td className="py-1.5 pr-2">{team ? <TeamChip id={team.id} name={team.name} color={team.color} link={false} /> : s.teamId}</td>
											<td className="py-1.5 pr-2 text-right mono">{s.leaguePoints}</td>
											<td className="py-1.5 text-right mono">{s.setsWon}-{s.setsLost}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</Card>
			</div>

			<Card title="Bracket preview">
				<div className="flex gap-8 overflow-x-auto p-2">
					{(bracket?.rounds ?? []).map((round, ri) => (
						<div key={ri} className="flex min-w-[220px] flex-col justify-around gap-5">
							<div className="text-center text-xs font-semibold tracking-wide text-muted uppercase">{round.name}</div>
							{round.matches.map((m, mi) => (
								<div key={mi} className="overflow-hidden rounded-lg border border-border bg-surface">
									<div className="px-3 py-2 text-sm">{m.teamAId ? <TeamChip id={m.teamAId} name={teamOf.get(m.teamAId)?.name ?? m.teamAId} color={teamOf.get(m.teamAId)?.color ?? 1} link={false} /> : <span className="text-muted">TBD{m.seedA ? ` (#${m.seedA})` : ""}</span>}</div>
									<div className="border-t border-border px-3 py-2 text-sm">{m.teamBId ? <TeamChip id={m.teamBId} name={teamOf.get(m.teamBId)?.name ?? m.teamBId} color={teamOf.get(m.teamBId)?.color ?? 1} link={false} /> : <span className="text-muted">TBD{m.seedB ? ` (#${m.seedB})` : ""}</span>}</div>
								</div>
							))}
						</div>
					))}
					{!bracket ? <p className="text-sm text-muted">No bracket generated yet.</p> : null}
				</div>
			</Card>
		</div>
	);
}
