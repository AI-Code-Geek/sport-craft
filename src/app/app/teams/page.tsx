"use client";

import { useEffect, useState } from "react";
import { fetchMe, getTeams, getStandings } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip, EmptyState } from "@/components/ui";
import type { StandingsRow } from "@/lib/types";

export default function TeamsPage() {
	const [teams, setTeams] = useState<TeamView[] | null>(null);
	const [standings, setStandings] = useState<StandingsRow[]>([]);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return setTeams([]);
			const [{ data: t }, { data: s }] = await Promise.all([getTeams(data.tournamentId), getStandings(data.tournamentId)]);
			setTeams(t.teams ?? []);
			setStandings(s.standings ?? []);
		});
	}, []);

	if (teams === null) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
	if (teams.length === 0) {
		return <EmptyState icon="👥" title="No teams yet" sub="Teams are formed after the poll closes and captains run the position-based auction." />;
	}

	const rankOf = new Map(standings.map((s) => [s.teamId, s]));

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">All teams</h1>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{teams.map((team) => {
					const st = rankOf.get(team.id);
					return (
						<div key={team.id} id={team.id} className="rounded-2xl border border-border bg-surface">
							<div className="flex items-center justify-between border-b border-border px-4 py-2.5">
								<TeamChip id={team.id} name={team.name} color={team.color} link={false} />
								<span className="text-xs text-muted">Rank #{st ? st.rank : "—"}</span>
							</div>
							<div className="p-4">
								<div className="mb-2 flex justify-between text-xs text-muted">
									<span>Budget spent</span>
									<span className="mono">{team.budgetTotal - team.budgetRemaining} / {team.budgetTotal} pts</span>
								</div>
								<table className="w-full text-sm">
									<tbody>
										{team.roster.map((r) => (
											<tr key={r.userId} className="border-t border-border">
												<td className="py-1 pr-2 text-xs text-muted">{r.position}</td>
												<td className="py-1 pr-2">{r.name}{r.role === "captain" ? <span className="text-xs text-muted"> (C)</span> : null}</td>
												<td className="py-1 text-right mono text-xs">{r.soldPrice != null ? `${r.soldPrice} pts` : "—"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="border-t border-border px-4 py-2 text-xs text-muted">
								{st ? `${st.won}W – ${st.lost}L · ${st.setsWon}-${st.setsLost} sets` : "No results yet"}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
