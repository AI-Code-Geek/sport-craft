"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchMe, getTournament, getPoll, updateTournament, deleteTournament, exportTournamentUrl } from "@/lib/api-client";
import { Card, LifecycleStepper } from "@/components/ui";
import { fmtDateTime, tournamentStatusLabel } from "@/lib/format";
import type { Tournament } from "@/lib/types";

export default function TournamentSettingsPage() {
	const { org } = useParams<{ org: string }>();
	const router = useRouter();
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [t, setT] = useState<Tournament | null>(null);
	const [pollFrozen, setPollFrozen] = useState(false);
	const [saved, setSaved] = useState(false);
	const [confirmName, setConfirmName] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [guidelinesSaved, setGuidelinesSaved] = useState(false);
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			const [{ data: res }, { data: p }] = await Promise.all([getTournament(data.tournamentId), getPoll(data.tournamentId)]);
			setT(res.tournament ?? null);
			setPollFrozen(p.poll?.frozen ?? false);
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

	async function saveGuidelines() {
		if (!tournamentId || !t) return;
		await updateTournament(tournamentId, { guidelines: t.guidelines ?? "" });
		setGuidelinesSaved(true);
		setTimeout(() => setGuidelinesSaved(false), 2000);
	}

	async function exportJson() {
		if (!tournamentId || !t) return;
		setExporting(true);
		try {
			const res = await fetch(exportTournamentUrl(tournamentId));
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-export.json`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			setExporting(false);
		}
	}

	async function removeTournament() {
		if (!tournamentId || !t) return;
		setDeleting(true);
		try {
			await deleteTournament(tournamentId);
			router.push(`/app/${org}/admin`);
		} finally {
			setDeleting(false);
		}
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
						<span className="rounded-md bg-ok/15 px-2 py-1 text-xs font-bold uppercase text-ok">
							{tournamentStatusLabel(t.status, pollFrozen)}
						</span>
					</div>
					{t.pollOpenedAt ? <div className="mb-1 text-xs text-muted">Poll opened: {fmtDateTime(t.pollOpenedAt)}</div> : null}
					{t.pollClosedAt ? <div className="mb-3 text-xs text-muted">Poll closed: {fmtDateTime(t.pollClosedAt)}</div> : null}
					<LifecycleStepper status={t.status} pollFrozen={pollFrozen} />
					<div className="mt-3 border-t border-border pt-3">
						<button className="btn-secondary w-fit" disabled={exporting} onClick={exportJson}>
							{exporting ? "Exporting…" : "Export as JSON →"}
						</button>
						<p className="mt-1 text-xs text-muted">Full state — poll, rosters, auction log, schedule, results, standings, notifications.</p>
					</div>
				</Card>
			</div>

			<Card title="Rules & guidelines">
				<p className="mb-3 text-sm text-muted">
					Shown to every player on the tournament home page once it&apos;s open (not while still in draft).
					Use it for match rules, code of conduct, forfeiture policy, whatever players need to see.
				</p>
				<textarea
					className="input min-h-40 w-full"
					placeholder="e.g. Best of 3 sets to 25, win by 2. Teams must have 4 players on court to start. Forfeits after 10 min grace period…"
					value={t.guidelines ?? ""}
					onChange={(e) => setT({ ...t, guidelines: e.target.value })}
				/>
				<div className="mt-2 flex items-center gap-2">
					<button className="btn-primary w-fit" onClick={saveGuidelines}>Save guidelines</button>
					{guidelinesSaved ? <span className="text-xs text-ok">Saved.</span> : null}
				</div>
			</Card>

			<Card title="Danger zone" className="border-bad/40">
				<p className="mb-3 text-sm text-muted">
					Permanently deletes this tournament and everything tied to it — poll, teams, positions,
					auction, schedule, and notifications. This cannot be undone.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<input
						className="input w-auto"
						placeholder={`Type "${t.name}" to confirm`}
						value={confirmName}
						onChange={(e) => setConfirmName(e.target.value)}
					/>
					<button
						className="btn-danger"
						disabled={deleting || confirmName !== t.name}
						onClick={removeTournament}
					>
						{deleting ? "Deleting…" : "Delete tournament"}
					</button>
				</div>
			</Card>
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
