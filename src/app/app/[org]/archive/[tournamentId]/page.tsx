"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTournament, getTeams, getStandings, getBracket, getSchedule } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip } from "@/components/ui";
import type { Tournament, StandingsRow, Bracket, Match } from "@/lib/types";

export default function ArchivedTournamentPage() {
	const { tournamentId } = useParams<{ org: string; tournamentId: string }>();
	const [tournament, setTournament] = useState<Tournament | null | undefined>(undefined);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [standings, setStandings] = useState<StandingsRow[]>([]);
	const [bracket, setBracket] = useState<Bracket | null>(null);
	const [matches, setMatches] = useState<Match[]>([]);

	useEffect(() => {
		Promise.all([
			getTournament(tournamentId),
			getTeams(tournamentId),
			getStandings(tournamentId),
			getBracket(tournamentId),
			getSchedule(tournamentId),
		]).then(([t, te, s, b, sc]) => {
			setTournament(t.data.tournament ?? null);
			setTeams(te.data.teams ?? []);
			setStandings(s.data.standings ?? []);
			setBracket(b.data.bracket ?? null);
			setMatches(sc.data.matches ?? []);
		});
	}, [tournamentId]);

	const teamOf = new Map(teams.map((t) => [t.id, t]));

	if (tournament === undefined) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
	if (!tournament) return <Card><p className="text-sm text-muted">Tournament not found.</p></Card>;

	// Winner: the playoff Final's winner if a bracket ran it, otherwise the top of group-stage standings.
	const finalRound = bracket?.rounds[bracket.rounds.length - 1];
	const finalMatchId = finalRound?.matches[0]?.matchId ?? null;
	const finalMatch = finalMatchId ? matches.find((m) => m.id === finalMatchId) : null;
	const winnerId = finalMatch?.winnerTeamId ?? standings[0]?.teamId ?? null;
	const winner = winnerId ? teamOf.get(winnerId) : null;

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="text-xl font-bold">{tournament.name}</h1>
				<span className="rounded-md bg-ok/15 px-2 py-1 text-xs font-bold text-ok uppercase">Completed</span>
			</div>

			{winner ? (
				<Card>
					<div className="flex flex-col items-center gap-2 py-4 text-center">
						<div className="text-3xl">🏆</div>
						<div className="text-xs font-semibold tracking-wide text-muted uppercase">Champion</div>
						<TeamChip id={winner.id} name={winner.name} color={winner.color} link={false} />
					</div>
				</Card>
			) : null}

			<Card title="Final standings">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-muted">
							<tr>
								<th className="pb-2 pr-2">#</th>
								<th className="pb-2 pr-2">Team</th>
								<th className="pb-2 pr-2 text-right">W</th>
								<th className="pb-2 pr-2 text-right">L</th>
								<th className="pb-2 text-right">League Pts</th>
							</tr>
						</thead>
						<tbody>
							{standings.map((s) => {
								const team = teamOf.get(s.teamId);
								return (
									<tr key={s.teamId} className="border-t border-border">
										<td className="py-2 pr-2 mono">{s.rank}</td>
										<td className="py-2 pr-2">{team ? <TeamChip id={team.id} name={team.name} color={team.color} link={false} /> : s.teamId}</td>
										<td className="py-2 pr-2 text-right mono">{s.won}</td>
										<td className="py-2 pr-2 text-right mono">{s.lost}</td>
										<td className="py-2 text-right mono font-bold">{s.leaguePoints}</td>
									</tr>
								);
							})}
							{standings.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-muted">No standings recorded.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</Card>

			{bracket ? (
				<Card title="Playoff bracket">
					<div className="flex gap-8 overflow-x-auto pb-2">
						{bracket.rounds.map((round, ri) => (
							<div key={ri} className="flex min-w-[220px] flex-col justify-around gap-5">
								<div className="text-center text-xs font-semibold tracking-wide text-muted uppercase">{round.name}</div>
								{round.matches.map((m, mi) => (
									<div key={mi} className="overflow-hidden rounded-lg border border-border bg-surface">
										{[m.teamAId, m.teamBId].map((tid, i) => {
											const team = tid ? teamOf.get(tid) : null;
											return (
												<div key={i} className={i === 0 ? "border-b border-border px-3 py-2 text-sm" : "px-3 py-2 text-sm"}>
													{team ? <TeamChip id={team.id} name={team.name} color={team.color} link={false} /> : <span className="text-muted">TBD</span>}
												</div>
											);
										})}
									</div>
								))}
							</div>
						))}
					</div>
				</Card>
			) : null}
		</div>
	);
}
