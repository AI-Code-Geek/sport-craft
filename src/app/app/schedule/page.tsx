"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, getSchedule, getTeams } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match } from "@/lib/types";

export default function SchedulePage() {
	const [matches, setMatches] = useState<Match[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [teamFilter, setTeamFilter] = useState("");
	const [roundFilter, setRoundFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			const [{ data: s }, { data: t }] = await Promise.all([getSchedule(data.tournamentId), getTeams(data.tournamentId)]);
			setMatches(s.matches ?? []);
			setTeams(t.teams ?? []);
		});
	}, []);

	const teamOf = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

	const filtered = matches
		.filter((m) => !teamFilter || m.teamAId === teamFilter || m.teamBId === teamFilter)
		.filter((m) => !roundFilter || m.round === roundFilter)
		.filter((m) => !statusFilter || m.status === statusFilter)
		.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

	function scoreLabel(m: Match) {
		const a = m.sets.filter((s) => s.status === "completed" && s.a > s.b).length;
		const b = m.sets.filter((s) => s.status === "completed" && s.b > s.a).length;
		return `${a}–${b}`;
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Match schedule</h1>

			<div className="flex flex-wrap gap-2">
				<select className="input w-auto" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
					<option value="">All teams</option>
					{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
				</select>
				<select className="input w-auto" value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)}>
					<option value="">All rounds</option>
					<option value="group">Group stage</option>
					<option value="semifinal">Semifinal</option>
					<option value="final">Final</option>
				</select>
				<select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
					<option value="">All statuses</option>
					<option value="live">Live</option>
					<option value="scheduled">Scheduled</option>
					<option value="completed">Completed</option>
				</select>
			</div>

			<Card>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-muted">
							<tr>
								<th className="pb-2 pr-2">Date &amp; time</th>
								<th className="pb-2 pr-2">Matchup</th>
								<th className="pb-2 pr-2">Venue</th>
								<th className="pb-2 pr-2">Status</th>
								<th className="pb-2 text-right">Score</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((m) => {
								const a = teamOf.get(m.teamAId);
								const b = teamOf.get(m.teamBId);
								return (
									<tr key={m.id} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => (window.location.href = `/app/matches/${m.id}`)}>
										<td className="py-2 pr-2 text-xs">{fmtDateTime(m.scheduledAt)}</td>
										<td className="py-2 pr-2">
											<div className="flex items-center gap-1.5">
												{a ? <TeamChip id={a.id} name={a.name} color={a.color} link={false} /> : m.teamAId}
												<span className="text-xs text-muted">vs</span>
												{b ? <TeamChip id={b.id} name={b.name} color={b.color} link={false} /> : m.teamBId}
											</div>
										</td>
										<td className="py-2 pr-2 text-xs text-muted">{m.venue} · {m.court}</td>
										<td className="py-2 pr-2"><StatusBadge status={m.status} /></td>
										<td className="py-2 text-right mono">{m.status === "completed" || m.status === "live" ? scoreLabel(m) : "—"}</td>
									</tr>
								);
							})}
							{filtered.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-muted">No matches match these filters.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</Card>
		</div>
	);
}
