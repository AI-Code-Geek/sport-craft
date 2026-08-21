"use client";

import { useEffect, useState } from "react";
import { fetchMe, getPoll, pollAction, pollPromote, pollVote } from "@/lib/api-client";
import type { PollEntryView } from "@/lib/api-client";
import { Card, StatusBadge, Stat } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default function AdminPollPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [entries, setEntries] = useState<PollEntryView[]>([]);
	const [capacity, setCapacity] = useState(0);
	const [busy, setBusy] = useState(false);

	async function load(tid: string) {
		const { data } = await getPoll(tid);
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

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h1 className="text-xl font-bold">Manage poll</h1>
				<div className="flex gap-2">
					<button disabled={busy} className="btn-secondary" onClick={() => doAction("open")}>Open poll</button>
					<button disabled={busy} className="btn-outline" onClick={() => doAction("freeze")}>Freeze poll</button>
					<button disabled={busy} className="btn-danger" onClick={() => doAction("close")}>Close poll</button>
				</div>
			</div>

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
