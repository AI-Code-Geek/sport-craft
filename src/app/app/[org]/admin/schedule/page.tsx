"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchMe, getSchedule, generateSchedule, getTeams, getTournament, updateTournament, rescheduleMatch, scoreAction } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match } from "@/lib/types";

/** One time slot per court-cycle, `durationMinutes` apart, starting at `startTime` ("HH:MM"). */
function timeSlots(startTime: string, durationMinutes: number, count: number): string[] {
	const [h, m] = startTime.split(":").map(Number);
	let mins = (h || 0) * 60 + (m || 0);
	const slots: string[] = [];
	for (let i = 0; i < count; i++) {
		const clamped = ((mins % 1440) + 1440) % 1440;
		slots.push(`${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`);
		mins += durationMinutes;
	}
	return slots;
}

export default function AdminSchedulePage() {
	const { org } = useParams<{ org: string }>();
	const router = useRouter();
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [matches, setMatches] = useState<Match[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [venue, setVenue] = useState("Community Gym");
	const [courts, setCourts] = useState("Court A, Court B");
	const [startTime, setStartTime] = useState("18:00");
	const [matchDurationMinutes, setMatchDurationMinutes] = useState(75);
	const [startDate, setStartDate] = useState("2026-09-06");
	const [daysBetween, setDaysBetween] = useState(7);
	const [winPoints, setWinPoints] = useState(2);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editScheduledAt, setEditScheduledAt] = useState("");
	const [editCourt, setEditCourt] = useState("");
	const [editError, setEditError] = useState("");

	async function load(tid: string) {
		const [{ data: s }, { data: t }] = await Promise.all([getSchedule(tid), getTeams(tid)]);
		setMatches(s.matches ?? []);
		setTeams(t.teams ?? []);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			const { data: t } = await getTournament(data.tournamentId);
			if (t.tournament) setWinPoints(t.tournament.winPoints ?? 2);
			await load(data.tournamentId);
		});
	}, []);

	async function generate() {
		if (!tournamentId) return;
		setBusy(true);
		setError("");
		const courtList = courts.split(",").map((s) => s.trim()).filter(Boolean);
		const matchesPerRound = Math.floor(teams.length / 2);
		const slotsNeeded = Math.max(1, Math.ceil(matchesPerRound / (courtList.length || 1)));
		const [{ ok, data }] = await Promise.all([
			generateSchedule(tournamentId, {
				venue,
				courts: courtList,
				times: timeSlots(startTime, matchDurationMinutes, slotsNeeded),
				startDate,
				daysBetween,
			}),
			updateTournament(tournamentId, { winPoints }),
		]);
		setBusy(false);
		if (!ok) return setError(data.error ?? "Could not generate the schedule.");
		await load(tournamentId);
	}

	function startEdit(m: Match) {
		setEditingId(m.id);
		setEditScheduledAt(m.scheduledAt.slice(0, 16));
		setEditCourt(m.court);
		setEditError("");
	}
	function cancelEdit() {
		setEditingId(null);
		setEditError("");
	}
	async function saveEdit(matchId: string) {
		if (!tournamentId) return;
		const { ok, data } = await rescheduleMatch(tournamentId, matchId, { scheduledAt: editScheduledAt, court: editCourt });
		if (!ok) return setEditError(data.error ?? "Could not save this match.");
		setEditingId(null);
		await load(tournamentId);
	}

	/** "Start match" marks it live immediately (0-0) before opening Live Scoring, instead of leaving it `scheduled` until the first point. */
	async function goScoreMatch(m: Match) {
		if (tournamentId && m.status === "scheduled") await scoreAction(tournamentId, m.id, "start");
		router.push(`/app/${org}/admin/scoring?match=${m.id}`);
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
						<div className="grid grid-cols-2 gap-3">
							<Field label="Start time"><input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
							<Field label="Match duration (min)"><input type="number" min={1} className="input" value={matchDurationMinutes} onChange={(e) => setMatchDurationMinutes(Number(e.target.value))} /></Field>
						</div>
						<Field label="Start date"><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Days between rounds"><input type="number" className="input" value={daysBetween} onChange={(e) => setDaysBetween(Number(e.target.value))} /></Field>
							<Field label="Points per win"><input type="number" min={1} className="input" value={winPoints} onChange={(e) => setWinPoints(Number(e.target.value))} /></Field>
						</div>
						{error ? <p className="text-sm text-bad">{error}</p> : null}
						<button disabled={busy} className="btn-primary" onClick={generate}>Generate &amp; publish schedule</button>
						<p className="text-xs text-muted">
							Single round robin — every team plays every other team once. Match times fill your courts starting
							at the start time, then move to the next slot after each match&apos;s duration. Re-generating replaces
							the current schedule.
						</p>
					</div>
				</Card>
				<Card title={`Schedule — ${group.length} matches`}>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="text-left text-xs text-muted">
								<tr><th className="pb-2 pr-2">#</th><th className="pb-2 pr-2">Date &amp; time</th><th className="pb-2 pr-2">Matchup</th><th className="pb-2 pr-2">Court</th><th className="pb-2 pr-2">Status</th><th className="pb-2 text-right">Action</th></tr>
							</thead>
							<tbody>
								{group.map((m, i) => {
									const a = teamOf.get(m.teamAId);
									const b = teamOf.get(m.teamBId);
									const editing = editingId === m.id;
									return (
										<tr key={m.id} className="border-t border-border">
											<td className="py-1.5 pr-2 text-muted">{i + 1}</td>
											{editing ? (
												<>
													<td className="py-1.5 pr-2">
														<input type="datetime-local" className="input" value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} />
													</td>
													<td className="py-1.5 pr-2">
														<div className="flex items-center gap-1.5">
															{a ? <TeamChip id={a.id} name={a.name} color={a.color} link={false} /> : m.teamAId}
															<span className="text-xs text-muted">vs</span>
															{b ? <TeamChip id={b.id} name={b.name} color={b.color} link={false} /> : m.teamBId}
														</div>
													</td>
													<td className="py-1.5 pr-2">
														<input className="input" value={editCourt} onChange={(e) => setEditCourt(e.target.value)} />
													</td>
													<td className="py-1.5 pr-2"><StatusBadge status={m.status} /></td>
													<td className="py-1.5 text-right">
														<div className="flex justify-end gap-2">
															<button className="btn-outline" onClick={cancelEdit}>Cancel</button>
															<button className="btn-primary" onClick={() => saveEdit(m.id)}>Save</button>
														</div>
													</td>
												</>
											) : (
												<>
													<td className="py-1.5 pr-2 text-xs">{fmtDateTime(m.scheduledAt)}</td>
													<td className="py-1.5 pr-2">
														<div className="flex items-center gap-1.5">
															{a ? <TeamChip id={a.id} name={a.name} color={a.color} link={false} /> : m.teamAId}
															<span className="text-xs text-muted">vs</span>
															{b ? <TeamChip id={b.id} name={b.name} color={b.color} link={false} /> : m.teamBId}
														</div>
													</td>
													<td className="py-1.5 pr-2 text-xs text-muted">{m.court}</td>
													<td className="py-1.5 pr-2"><StatusBadge status={m.status} /></td>
													<td className="py-1.5 text-right">
														<div className="flex justify-end gap-2">
														<button className="btn-outline" onClick={() => startEdit(m)}>Edit</button>
															{m.status === "scheduled" || m.status === "live" || m.status === "completed" ? (
																<button className="btn-outline" onClick={() => goScoreMatch(m)}>
																	{m.status === "live" ? "Continue scoring" : m.status === "completed" ? "Fix score" : "Start match"}
																</button>
															) : null}
														</div>
													</td>
												</>
											)}
										</tr>
									);
								})}
								{editError ? <tr><td colSpan={6} className="pt-2 text-right text-xs text-bad">{editError}</td></tr> : null}
								{group.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-muted">No schedule yet — generate one on the left.</td></tr> : null}
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
