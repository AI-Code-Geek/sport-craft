"use client";

import { useEffect, useState } from "react";
import { fetchMe, getOrganizers, setOrganizer, getTournament } from "@/lib/api-client";
import { Card } from "@/components/ui";
import type { PublicUser, Tournament } from "@/lib/types";

export default function OrganizersPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [tournament, setTournament] = useState<Tournament | null>(null);
	const [organizers, setOrganizers] = useState<PublicUser[]>([]);
	const [candidates, setCandidates] = useState<PublicUser[]>([]);
	const [query, setQuery] = useState("");

	async function load(tid: string) {
		const [{ data: o }, { data: t }] = await Promise.all([getOrganizers(tid), getTournament(tid)]);
		setOrganizers(o.organizers ?? []);
		setCandidates(o.candidates ?? []);
		setTournament(t.tournament ?? null);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
		});
	}, []);

	async function add(userId: string) {
		if (!tournamentId) return;
		await setOrganizer(tournamentId, "add", userId);
		await load(tournamentId);
	}
	async function remove(userId: string) {
		if (!tournamentId) return;
		await setOrganizer(tournamentId, "remove", userId);
		await load(tournamentId);
	}

	const filtered = candidates.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Organizer committee</h1>
			<p className="text-sm text-muted">{tournament?.name}</p>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card title="Currently assigned">
					<div className="flex flex-col divide-y divide-border">
						{organizers.map((u) => (
							<div key={u.userid} className="flex items-center justify-between py-2">
								<div>
									<div>{u.name}</div>
									<div className="text-xs text-muted">{u.email}</div>
								</div>
								<button className="btn-danger" onClick={() => remove(u.userid)}>Remove</button>
							</div>
						))}
						{organizers.length === 0 ? <p className="py-2 text-sm text-muted">No organizers assigned yet — assign at least one before opening the poll.</p> : null}
					</div>
				</Card>
				<Card title="Add an organizer">
					<input className="input mb-2" placeholder="Search community members…" value={query} onChange={(e) => setQuery(e.target.value)} />
					<div className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
						{filtered.map((u) => (
							<div key={u.userid} className="flex items-center justify-between py-1.5 text-sm">
								<span>{u.name}</span>
								<button className="btn-secondary" onClick={() => add(u.userid)}>Add</button>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
	);
}
