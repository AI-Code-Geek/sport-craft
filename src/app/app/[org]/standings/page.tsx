"use client";

import { Fragment, useEffect, useState } from "react";
import { fetchMe, getStandings, getTeams } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip } from "@/components/ui";
import type { StandingsRow } from "@/lib/types";

export default function StandingsPage() {
	const [standings, setStandings] = useState<StandingsRow[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [cutoff, setCutoff] = useState(4);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			const [{ data: s }, { data: t }] = await Promise.all([getStandings(data.tournamentId), getTeams(data.tournamentId)]);
			setStandings(s.standings ?? []);
			setCutoff(s.playoffTeamCount ?? 4);
			setTeams(t.teams ?? []);
		});
	}, []);

	const teamOf = new Map(teams.map((t) => [t.id, t]));

	return (
		<div className="flex flex-col gap-1">
			<h1 className="text-xl font-bold">League standings</h1>
			<p className="mb-3 text-sm text-muted">Top {cutoff} advance to the playoffs.</p>

			<Card>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-muted">
							<tr>
								<th className="pb-2 pr-2">#</th>
								<th className="pb-2 pr-2">Team</th>
								<th className="pb-2 pr-2 text-right">P</th>
								<th className="pb-2 pr-2 text-right">W</th>
								<th className="pb-2 pr-2 text-right">L</th>
								<th className="pb-2 pr-2 text-right">Sets W</th>
								<th className="pb-2 pr-2 text-right">Sets L</th>
								<th className="pb-2 pr-2 text-right">Pts For</th>
								<th className="pb-2 pr-2 text-right">Pts Against</th>
								<th className="pb-2 pr-2 text-right">Diff</th>
								<th className="pb-2 text-right">League Pts</th>
							</tr>
						</thead>
						<tbody>
							{standings.map((s) => {
								const team = teamOf.get(s.teamId);
								const diff = s.pointsFor - s.pointsAgainst;
								return (
									<Fragment key={s.teamId}>
										<tr className={`border-t border-border ${s.rank === cutoff ? "bg-warn/8" : ""}`}>
											<td className="py-2 pr-2 mono">{s.rank}</td>
											<td className="py-2 pr-2">{team ? <TeamChip id={team.id} name={team.name} color={team.color} /> : s.teamId}</td>
											<td className="py-2 pr-2 text-right mono">{s.played}</td>
											<td className="py-2 pr-2 text-right mono">{s.won}</td>
											<td className="py-2 pr-2 text-right mono">{s.lost}</td>
											<td className="py-2 pr-2 text-right mono">{s.setsWon}</td>
											<td className="py-2 pr-2 text-right mono">{s.setsLost}</td>
											<td className="py-2 pr-2 text-right mono">{s.pointsFor}</td>
											<td className="py-2 pr-2 text-right mono">{s.pointsAgainst}</td>
											<td className={`py-2 pr-2 text-right mono ${diff > 0 ? "text-ok" : diff < 0 ? "text-bad" : ""}`}>{diff > 0 ? "+" : ""}{diff}</td>
											<td className="py-2 text-right mono font-bold">{s.leaguePoints}</td>
										</tr>
										{s.rank === cutoff ? (
											<tr>
												<td colSpan={11} className="py-1 text-center text-xs text-muted">— playoff cutoff line (top {cutoff}) —</td>
											</tr>
										) : null}
									</Fragment>
								);
							})}
							{standings.length === 0 ? <tr><td colSpan={11} className="py-6 text-center text-muted">No completed matches yet.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</Card>
			<p className="mt-2 text-xs text-muted">Tie-break order: league points → set ratio → head-to-head → point differential.</p>
		</div>
	);
}
