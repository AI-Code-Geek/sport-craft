"use client";

import { useEffect, useState } from "react";
import { fetchMe, getPoll, pollAction, pollPromote, pollVote } from "@/lib/api-client";
import type { PollEntryView, PollView } from "@/lib/api-client";
import { Card, StatusBadge, Stat } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

/** Derived purely from the poll record — there's no separate "status" field, just openedAt/closedAt/frozen. */
function pollStatus(poll: PollView | null): "not_started" | "open" | "frozen" | "closed" {
	if (!poll || !poll.openedAt) return "not_started";
	if (poll.closedAt) return "closed";
	if (poll.frozen) return "frozen";
	return "open";
}

export default function AdminPollPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [poll, setPoll] = useState<PollView | null>(null);
	const [entries, setEntries] = useState<PollEntryView[]>([]);
	const [capacity, setCapacity] = useState(0);
	const [busy, setBusy] = useState(false);

	async function load(tid: string) {
		const { data } = await getPoll(tid);
		setPoll(data.poll ?? null);
		setEntries(data.poll?.entries ?? []);
		setCapacity(data.capacity ?? 0);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
		});
	}, []);

	async function doAction(action: "open" | "close" | "freeze") {
		if (!tournamentId) return;
		setBusy(true);
		await pollAction(tournamentId, action);
		await load(tournamentId);
		setBusy(false);
	}
	async function promote(userId: string) {
		if (!tournamentId) return;
		await pollPromote(tournamentId, userId);
		await load(tournamentId);
	}
	async function remove(userId: string) {
		if (!tournamentId) return;
		await pollVote(tournamentId, "withdraw", userId);
		await load(tournamentId);
	}

	const confirmed = entries.filter((e) => e.status === "confirmed");
	const waitlisted = entries.filter((e) => e.status === "waitlisted");
	const sorted = entries.filter((e) => e.status !== "withdrawn").slice().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

	const status = pollStatus(poll);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<h1 className="text-xl font-bold">Manage poll</h1>
					<StatusBadge status={status} />
				</div>
				<div className="flex gap-2">
					<button disabled={busy || status === "open"} className="btn-secondary" onClick={() => doAction("open")}>
						{status === "frozen" ? "Re-open poll" : "Open poll"}
					</button>
					<button disabled={busy || status === "not_started" || status === "closed"} className="btn-outline" onClick={() => doAction("freeze")}>Freeze poll</button>
					<button disabled={busy || status === "not_started" || status === "closed"} className="btn-danger" onClick={() => doAction("close")}>Close poll</button>
				</div>
			</div>
			<p className="text-xs text-muted">
				{status === "not_started" ? "The poll hasn't opened yet — players can't sign up until you open it."
					: status === "open" ? "Open — players can sign up now. Confirmed once capacity fills; the rest waitlist."
					: status === "frozen" ? "Frozen — no new signups, but nothing's final. Re-open to keep taking signups, or close to lock it in."
					: "Closed — signup is locked in. Move on to picking captains."}
			</p>

			<div className="grid gap-3 md:grid-cols-3">
				<Stat value={confirmed.length} label="Confirmed" />
				<Stat value={waitlisted.length} label="Waitlisted" />
				<Stat value={capacity} label="Capacity" />
			</div>

			<Card title="All entries">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-muted">
							<tr>
								<th className="pb-2 pr-2">#</th>
								<th className="pb-2 pr-2">Player</th>
								<th className="pb-2 pr-2">Signed up</th>
								<th className="pb-2 pr-2">Status</th>
								<th className="pb-2 text-right">Action</th>
							</tr>
						</thead>
						<tbody>
							{sorted.map((e, i) => (
								<tr key={e.userId} className="border-t border-border">
									<td className="py-1.5 pr-2 text-muted">{i + 1}</td>
									<td className="py-1.5 pr-2">{e.name}</td>
									<td className="py-1.5 pr-2 text-xs text-muted">{fmtDateTime(e.submittedAt)}</td>
									<td className="py-1.5 pr-2"><StatusBadge status={e.status} /></td>
									<td className="py-1.5 text-right">
										{e.status === "waitlisted" ? <button className="btn-outline" onClick={() => promote(e.userId)}>Promote</button> : null}
										{e.status === "confirmed" ? <button className="btn-outline" onClick={() => remove(e.userId)}>Remove</button> : null}
									</td>
								</tr>
							))}
							{sorted.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-muted">No signups yet.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</Card>
		</div>
	);
}
