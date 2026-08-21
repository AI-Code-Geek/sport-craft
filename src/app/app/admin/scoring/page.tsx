"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMe, getSchedule, getTeams, scoreAction, getMatch } from "@/lib/api-client";
import type { TeamView } from "@/lib/api-client";
import { Card, TeamChip } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Match } from "@/lib/types";

export default function AdminScoringPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [scoreable, setScoreable] = useState<Match[]>([]);
	const [teams, setTeams] = useState<TeamView[]>([]);
	const [matchId, setMatchId] = useState("");
	const [match, setMatch] = useState<Match | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	// A ref lock, not just the `busy` state: React state updates are batched/async, so two clicks
	// fired within the same tick (faster than a render) could both pass a state-only check. A ref
	// mutates synchronously, so the second call sees the lock immediately.
	const busyRef = useRef(false);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			const [{ data: s }, { data: t }] = await Promise.all([getSchedule(data.tournamentId), getTeams(data.tournamentId)]);
			const list = (s.matches ?? []).filter((m) => m.status === "live" || m.status === "scheduled");
			list.sort((a, b) => (a.status === "live" ? -1 : 1) - (b.status === "live" ? -1 : 1));
			setScoreable(list);
			setTeams(t.teams ?? []);
			if (list[0]) {
				setMatchId(list[0].id);
				setMatch(list[0]);
			}
		});
	}, []);

	async function reload(id: string) {
		if (!tournamentId) return;
		const { data } = await getMatch(tournamentId, id);
		setMatch(data.match ?? null);
	}

	async function pickMatch(id: string) {
		setMatchId(id);
		await reload(id);
	}

	// Cloudflare KV has no compare-and-swap, so the match record is a plain read-modify-write — two
	// requests in flight at once can race and one point gets silently lost. A single scorekeeper
	// tapping +1 rapidly is the realistic failure mode (not two people scoring the same match at
	// once), so disabling the controls until each request round-trips is enough to fix it in practice.
	async function act(action: "point" | "undo" | "nextset" | "end", side?: "a" | "b") {
		if (!tournamentId || !matchId || busyRef.current) return;
		busyRef.current = true;
		setBusy(true);
		setError("");
		try {
			const { ok, data } = await scoreAction(tournamentId, matchId, action, side);
			if (!ok) setError(data.error ?? "Action failed.");
			await reload(matchId);
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	}

	const teamOf = new Map(teams.map((t) => [t.id, t]));

	if (!match) return <Card><p className="text-sm text-muted">No scoreable matches — publish a schedule first.</p></Card>;

	const cur = match.sets[match.sets.length - 1];
	const setsA = match.sets.filter((s) => s.status === "completed" && s.a > s.b).length;
	const setsB = match.sets.filter((s) => s.status === "completed" && s.b > s.a).length;
	const a = teamOf.get(match.teamAId);
	const b = teamOf.get(match.teamBId);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Live scoring console</h1>
				<select className="input w-auto" value={matchId} onChange={(e) => pickMatch(e.target.value)}>
					{scoreable.map((m) => {
						const ta = teamOf.get(m.teamAId), tb = teamOf.get(m.teamBId);
						return <option key={m.id} value={m.id}>{ta?.name ?? m.teamAId} vs {tb?.name ?? m.teamBId} {m.status === "live" ? "· LIVE" : ""}</option>;
					})}
				</select>
			</div>

			{error ? <p className="text-sm text-bad">{error}</p> : null}

			<div className="grid gap-4 lg:grid-cols-[1fr_320px]">
				<div className="flex flex-col gap-4">
					<Card>
						<div className="mb-3 text-center text-xs text-muted">{match.round} · {fmtDateTime(match.scheduledAt)} · {match.venue} {match.court}</div>
						<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
							<div className="text-center">
								<div className="mb-2 text-base">{a ? <TeamChip id={a.id} name={a.name} color={a.color} link={false} /> : match.teamAId}</div>
								<div className="mono text-5xl font-black">{cur?.a ?? 0}</div>
								<div className="mt-2 flex justify-center gap-2">
									<button className="btn-outline" disabled={busy} onClick={() => act("undo", "a")}>−1</button>
									<button className="btn-primary" disabled={busy} onClick={() => act("point", "a")}>+1</button>
								</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-extrabold">{setsA}–{setsB}</div>
								<div className="text-xs text-muted">sets · set {cur?.setNumber ?? 1}</div>
							</div>
							<div className="text-center">
								<div className="mb-2 text-base">{b ? <TeamChip id={b.id} name={b.name} color={b.color} link={false} /> : match.teamBId}</div>
								<div className="mono text-5xl font-black">{cur?.b ?? 0}</div>
								<div className="mt-2 flex justify-center gap-2">
									<button className="btn-primary" disabled={busy} onClick={() => act("point", "b")}>+1</button>
									<button className="btn-outline" disabled={busy} onClick={() => act("undo", "b")}>−1</button>
								</div>
							</div>
						</div>
					</Card>
					<div className="flex gap-2">
						<button className="btn-outline" disabled={busy || !cur || cur.status === "in_progress"} onClick={() => act("nextset")}>Start next set</button>
						<button className="btn-danger" disabled={busy} onClick={() => act("end")}>End match</button>
					</div>
				</div>
				<Card title="Sets so far">
					<div className="flex flex-wrap justify-center gap-4">
						{match.sets.map((s) => (
							<div key={s.setNumber} className="text-center">
								<div className="mb-1 text-xs text-muted">Set {s.setNumber}</div>
								<div className={`mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-lg font-bold ${s.status === "completed" && s.a > s.b ? "bg-ok/15 text-ok" : "bg-surface-2"}`}>{s.a}</div>
								<div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg font-bold ${s.status === "completed" && s.b > s.a ? "bg-ok/15 text-ok" : "bg-surface-2"}`}>{s.b}</div>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
	);
}
