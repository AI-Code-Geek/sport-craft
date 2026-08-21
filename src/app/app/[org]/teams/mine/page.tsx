"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchMe, getTeams, getSchedule } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip, Meter, StatusBadge, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match } from "@/lib/types";

export default function MyTeamPage() {
	const { org } = useParams<{ org: string }>();
	const [team, setTeam] = useState<TeamView | null | undefined>(undefined);
	const [allTeams, setAllTeams] = useState<TeamView[]>([]);
	const [matches, setMatches] = useState<Match[]>([]);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.user || !data.tournamentId) return setTeam(null);
			const [{ data: t }, { data: sched }] = await Promise.all([getTeams(data.tournamentId), getSchedule(data.tournamentId)]);
			const mine = t.teams?.find((tm) => tm.roster.some((r) => r.userId === data.user!.userid)) ?? null;
			setTeam(mine);
			setAllTeams(t.teams ?? []);
			setMatches((sched.matches ?? []).filter((m) => mine && (m.teamAId === mine.id || m.teamBId === mine.id)));
		});
	}, []);

	if (team === undefined) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
	if (!team) {
		return (
			<EmptyState
				icon="🏐"
				title="You're not on a team yet"
				sub="Teams are formed after the poll closes — captains are picked, then the position-based auction fills every roster."
				action={<Link href={`/app/${org}/poll`} className="btn-primary mt-2">Check your poll status</Link>}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold"><TeamChip id={team.id} name={team.name} color={team.color} link={false} /></h1>
				<span className="text-sm text-muted">Captain: {team.captainName}</span>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<Card title="Budget" className="md:col-span-1">
					<div className="mb-1 text-2xl font-extrabold">{team.budgetRemaining} <span className="text-sm text-muted">pts left</span></div>
					<Meter pct={(100 * team.budgetRemaining) / team.budgetTotal} />
					<p className="mt-2 text-xs text-muted">{team.budgetTotal - team.budgetRemaining} of {team.budgetTotal} spent in the auction</p>
				</Card>
				<Card title="Roster (by position)" className="md:col-span-2">
					<table className="w-full text-sm">
						<tbody>
							{team.roster.map((r) => (
								<tr key={r.userId} className="border-t border-border first:border-t-0">
									<td className="py-1.5 pr-2"><span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">{r.position}</span></td>
									<td className="py-1.5 pr-2">{r.name}</td>
									<td className="py-1.5 text-right mono">{r.soldPrice != null ? `${r.soldPrice} pts` : <span className="text-muted">captain</span>}</td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</div>

			<Card title="Matches">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<tbody>
							{matches.map((m) => {
								const oppId = m.teamAId === team.id ? m.teamBId : m.teamAId;
								const opp = allTeams.find((tm) => tm.id === oppId);
								return (
									<tr key={m.id} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => (window.location.href = `/app/${org}/matches/${m.id}`)}>
										<td className="py-2 pr-2">{opp ? <TeamChip id={opp.id} name={opp.name} color={opp.color} link={false} /> : oppId}</td>
										<td className="py-2 pr-2 text-xs text-muted">{fmtDateTime(m.scheduledAt)} · {m.court}</td>
										<td className="py-2 text-right"><StatusBadge status={m.status} /></td>
									</tr>
								);
							})}
							{matches.length === 0 ? <tr><td className="py-4 text-center text-muted">No matches scheduled yet.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</Card>
		</div>
	);
}
