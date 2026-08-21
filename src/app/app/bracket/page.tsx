"use client";

import { useEffect, useState } from "react";
import { fetchMe, getBracket, getTeams } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip, EmptyState } from "@/components/ui";
import type { Bracket } from "@/lib/types";

export default function BracketPage() {
	const [bracket, setBracket] = useState<Bracket | null | undefined>(undefined);
	const [teams, setTeams] = useState<TeamView[]>([]);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return setBracket(null);
			const [{ data: b }, { data: t }] = await Promise.all([getBracket(data.tournamentId), getTeams(data.tournamentId)]);
			setBracket(b.bracket ?? null);
			setTeams(t.teams ?? []);
		});
	}, []);

	const teamOf = new Map(teams.map((t) => [t.id, t]));

	if (bracket === undefined) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
	if (!bracket) {
		return <EmptyState icon="🏆" title="No bracket yet" sub="The Org Admin generates the playoff bracket once the group stage is complete." />;
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Playoff bracket</h1>
			<div className="flex gap-8 overflow-x-auto pb-2">
				{bracket.rounds.map((round, ri) => (
					<div key={ri} className="flex min-w-[220px] flex-col justify-around gap-5">
						<div className="text-center text-xs font-semibold tracking-wide text-muted uppercase">{round.name}</div>
						{round.matches.map((m, mi) => (
							<div key={mi}>
								<div className="overflow-hidden rounded-lg border border-border bg-surface">
									<BracketSlot teamId={m.teamAId} seed={m.seedA} teamOf={teamOf} />
									<div className="border-t border-border" />
									<BracketSlot teamId={m.teamBId} seed={m.seedB} teamOf={teamOf} />
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

function BracketSlot({ teamId, seed, teamOf }: { teamId: string | null; seed: number | null; teamOf: Map<string, TeamView> }) {
	const team = teamId ? teamOf.get(teamId) : null;
	return (
		<div className="flex items-center justify-between px-3 py-2 text-sm">
			{team ? <TeamChip id={team.id} name={team.name} color={team.color} link={false} /> : <span className="text-muted">TBD{seed ? ` (#${seed})` : ""}</span>}
		</div>
	);
}
