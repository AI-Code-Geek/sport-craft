"use client";

import { useEffect, useState } from "react";
import { fetchMe, getTournament, updateTournament } from "@/lib/api-client";
import { Card, LifecycleStepper } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Tournament } from "@/lib/types";

export default function TournamentSettingsPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [t, setT] = useState<Tournament | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			const { data: res } = await getTournament(data.tournamentId);
			setT(res.tournament ?? null);
		});
	}, []);

	async function save() {
		if (!tournamentId || !t) return;
		await updateTournament(tournamentId, {
			name: t.name, setsToWin: t.setsToWin, pointsPerSet: t.pointsPerSet, winBy: t.winBy, playoffTeamCount: t.playoffTeamCount,
		});
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	if (!t) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
	const locked = t.status !== "draft";

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Tournament settings</h1>
			<div className="grid gap-4 lg:grid-cols-[1fr_380px]">
				<Card title="Variables">
					<div className="flex flex-col gap-3">
						<Field label="Name">
							<input className="input" value={t.name} disabled={locked} onChange={(e) => setT({ ...t, name: e.target.value })} />
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Max teams"><input type="number" className="input" value={t.maxTeams} disabled /></Field>
							<Field label="Team size"><input type="number" className="input" value={t.teamSize} disabled /></Field>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Auction budget"><input type="number" className="input" value={t.budgetPoints} disabled /></Field>
							<Field label="Poll capacity"><input type="number" className="input" value={t.pollCapacity} disabled /></Field>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<Field label="Sets to win"><input type="number" className="input" value={t.setsToWin} onChange={(e) => setT({ ...t, setsToWin: Number(e.target.value) })} /></Field>
							<Field label="Points/set"><input type="number" className="input" value={t.pointsPerSet} onChange={(e) => setT({ ...t, pointsPerSet: Number(e.target.value) })} /></Field>
							<Field label="Win by"><input type="number" className="input" value={t.winBy} onChange={(e) => setT({ ...t, winBy: Number(e.target.value) })} /></Field>
						</div>
						<Field label="Playoff team count">
							<select className="input w-40" value={t.playoffTeamCount} onChange={(e) => setT({ ...t, playoffTeamCount: Number(e.target.value) })}>
								<option value={2}>2</option>
								<option value={4}>4</option>
								<option value={8}>8</option>
							</select>
						</Field>
						{locked ? <p className="text-xs text-muted">Team-count / roster-size variables lock once the poll opens (they define the confirmed-player capacity).</p> : null}
						<div className="flex items-center gap-2">
							<button className="btn-primary w-fit" onClick={save}>Save changes</button>
							{saved ? <span className="text-xs text-ok">Saved.</span> : null}
						</div>
					</div>
				</Card>
				<Card title="Status">
					<div className="mb-2">
						<span className="rounded-md bg-ok/15 px-2 py-1 text-xs font-bold uppercase text-ok">{t.status.replace(/_/g, " ")}</span>
					</div>
					{t.pollOpenedAt ? <div className="mb-1 text-xs text-muted">Poll opened: {fmtDateTime(t.pollOpenedAt)}</div> : null}
					{t.pollClosedAt ? <div className="mb-3 text-xs text-muted">Poll closed: {fmtDateTime(t.pollClosedAt)}</div> : null}
					<LifecycleStepper status={t.status} />
				</Card>
			</div>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1 text-sm">
			<span className="text-xs text-muted">{label}</span>
			{children}
		</label>
	);
}
