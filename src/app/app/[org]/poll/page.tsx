"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMe, getPoll, pollVote } from "@/lib/api-client";
import type { PollEntryView } from "@/lib/api-client";
import { Card, Meter, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

type EntryRow = PollEntryView;

export default function PollPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [entries, setEntries] = useState<EntryRow[]>([]);
	const [capacity, setCapacity] = useState(0);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (tid: string) => {
		const { data } = await getPoll(tid);
		setEntries(data.poll?.entries ?? []);
		setCapacity(data.capacity ?? 0);
	}, []);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.user || !data.tournamentId) return;
			setUserId(data.user.userid);
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
		});
	}, [load]);

	async function join() {
		if (!tournamentId) return;
		setBusy(true);
		await pollVote(tournamentId, "join");
		await load(tournamentId);
		setBusy(false);
	}
	async function withdraw() {
		if (!tournamentId) return;
		setBusy(true);
		await pollVote(tournamentId, "withdraw");
		await load(tournamentId);
		setBusy(false);
	}

	const confirmed = entries.filter((e) => e.status === "confirmed");
	const waitlisted = entries.filter((e) => e.status === "waitlisted");
	const mine = entries.find((e) => e.userId === userId);
	const sorted = entries.filter((e) => e.status !== "withdrawn").slice().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

	if (!tournamentId) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Season signup poll</h1>

			<div className="grid gap-4 md:grid-cols-2">
				<Card title="Capacity">
					<div className="mb-1 flex items-end justify-between">
						<span className="text-2xl font-extrabold">{confirmed.length} / {capacity}</span>
						<span className="text-xs text-muted">confirmed players</span>
					</div>
					<Meter pct={capacity ? (100 * confirmed.length) / capacity : 0} />
					<p className="mt-2 text-xs text-muted">
						{waitlisted.length ? `${waitlisted.length} on the waitlist — promoted in order if someone withdraws.` : "No one on the waitlist yet."}
					</p>
				</Card>
				<Card title="Your status">
					{!mine || mine.status === "withdrawn" ? (
						<div className="flex flex-col gap-2">
							<p className="text-sm text-muted">You haven&apos;t joined this poll yet.</p>
							<button disabled={busy} onClick={join} className="btn-primary w-fit">Join the poll →</button>
						</div>
					) : (
						<div className="flex flex-col gap-2">
							<StatusBadge status={mine.status} />
							<p className="text-xs text-muted">Signed up {fmtDateTime(mine.submittedAt)}</p>
							<button disabled={busy} onClick={withdraw} className="btn-danger w-fit">Withdraw</button>
						</div>
					)}
				</Card>
			</div>

			<Card title="Confirmed & waitlisted (signup order)">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-muted">
							<tr>
								<th className="pb-2 pr-2">#</th>
								<th className="pb-2 pr-2">Player</th>
								<th className="pb-2 pr-2">Signed up</th>
								<th className="pb-2">Status</th>
							</tr>
						</thead>
						<tbody>
							{sorted.map((e, i) => (
								<tr key={e.userId} className="border-t border-border">
									<td className="py-1.5 pr-2 text-muted">{i + 1}</td>
									<td className="py-1.5 pr-2">{e.name}</td>
									<td className="py-1.5 pr-2 text-xs text-muted">{fmtDateTime(e.submittedAt)}</td>
									<td className="py-1.5"><StatusBadge status={e.status} /></td>
								</tr>
							))}
							{sorted.length === 0 ? (
								<tr><td colSpan={4} className="py-6 text-center text-muted">The poll hasn&apos;t opened yet.</td></tr>
							) : null}
						</tbody>
					</table>
				</div>
			</Card>
		</div>
	);
}
