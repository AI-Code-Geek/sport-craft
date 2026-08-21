"use client";

import { useEffect, useState } from "react";
import { fetchMe, getSchedule, generateSchedule, getTeams } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match } from "@/lib/types";

export default function AdminSchedulePage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [matches, setMatches] = useState<Match[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [venue, setVenue] = useState("Estancia Community Gym");
	const [courts, setCourts] = useState("Court A, Court B");
	const [times, setTimes] = useState("18:00, 19:15");
	const [startDate, setStartDate] = useState("2026-09-06");
	const [daysBetween, setDaysBetween] = useState(7);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function load(tid: string) {
		const [{ data: s }, { data: t }] = await Promise.all([getSchedule(tid), getTeams(tid)]);
		setMatches(s.matches ?? []);
		setTeams(t.teams ?? []);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
		});
	}, []);

	async function generate() {
		if (!tournamentId) return;
		setBusy(true);
		setError("");
		const { ok, data } = await generateSchedule(tournamentId, {
			venue,
			courts: courts.split(",").map((s) => s.trim()).filter(Boolean),
			times: times.split(",").map((s) => s.trim()).filter(Boolean),
			startDate,
			daysBetween,
		});
		setBusy(false);
		if (!ok) return setError(data.error ?? "Could not generate the schedule.");
		await load(tournamentId);
	}

	const teamOf = new Map(teams.map((t) => [t.id, t]));
	const group = matches.filter((m) => m.round === "group").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Schedule generator</h1>
			<div className="grid gap-4 lg:grid-cols-[340px_1fr]">
				<Card title="Configuration">
					<div className="flex flex-col gap-3">
						<Field label="Venue"><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
						<Field label="Courts (comma-separated)"><input className="input" value={courts} onChange={(e) => setCourts(e.target.value)} /></Field>
						<Field label="Times (comma-separated, HH:MM)"><input className="input" value={times} onChange={(e) => setTimes(e.target.value)} /></Field>
						<Field label="Start date"><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
						<Field label="Days between rounds"><input type="number" className="input" value={daysBetween} onChange={(e) => setDaysBetween(Number(e.target.value))} /></Field>
						{error ? <p className="text-sm text-bad">{error}</p> : null}
						<button disabled={busy} className="btn-primary" onClick={generate}>Generate &amp; publish schedule</button>
						<p className="text-xs text-muted">Single round robin — every team plays every other team once. Re-generating replaces the current schedule.</p>
					</div>
				</Card>
				<Card title={`Schedule — ${group.length} matches`}>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="text-left text-xs text-muted">
								<tr><th className="pb-2 pr-2">#</th><th className="pb-2 pr-2">Date &amp; time</th><th className="pb-2 pr-2">Matchup</th><th className="pb-2 pr-2">Court</th><th className="pb-2">Status</th></tr>
							</thead>
							<tbody>
								{group.map((m, i) => {
									const a = teamOf.get(m.teamAId);
									const b = teamOf.get(m.teamBId);
									return (
										<tr key={m.id} className="border-t border-border">
											<td className="py-1.5 pr-2 text-muted">{i + 1}</td>
											<td className="py-1.5 pr-2 text-xs">{fmtDateTime(m.scheduledAt)}</td>
											<td className="py-1.5 pr-2">
												<div className="flex items-center gap-1.5">
													{a ? <TeamChip id={a.id} name={a.name} color={a.color} link={false} /> : m.teamAId}
													<span className="text-xs text-muted">vs</span>
													{b ? <TeamChip id={b.id} name={b.name} color={b.color} link={false} /> : m.teamBId}
												</div>
											</td>
											<td className="py-1.5 pr-2 text-xs text-muted">{m.court}</td>
											<td className="py-1.5"><StatusBadge status={m.status} /></td>
										</tr>
									);
								})}
								{group.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-muted">No schedule yet — generate one on the left.</td></tr> : null}
							</tbody>
						</table>
					</div>
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
