"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTournament } from "@/lib/api-client";
import { Card } from "@/components/ui";

export default function NewTournamentPage() {
	const router = useRouter();
	const [name, setName] = useState("Estancia Fall Volleyball League 2026");
	const [maxTeams, setMaxTeams] = useState(6);
	const [teamSize, setTeamSize] = useState(6);
	const [budgetPoints, setBudgetPoints] = useState(100);
	const [setsToWin, setSetsToWin] = useState(2);
	const [pointsPerSet, setPointsPerSet] = useState(25);
	const [winBy, setWinBy] = useState(2);
	const [playoffTeamCount, setPlayoffTeamCount] = useState(4);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function create() {
		setBusy(true);
		setError("");
		const { ok, data } = await createTournament({
			name, maxTeams, teamSize, budgetPoints, setsToWin, pointsPerSet, winBy, playoffTeamCount,
		});
		setBusy(false);
		if (!ok) return setError(data.error ?? "Failed to create tournament.");
		router.push("/app/admin/organizers");
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Create a new tournament</h1>
			<p className="text-sm text-muted">Super Admin only. Once created, assign an Organizer committee to run it day to day.</p>

			<Card title="Core variables" className="max-w-xl">
				<div className="flex flex-col gap-3">
					<Field label="Tournament name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Max teams"><input type="number" className="input" value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))} /></Field>
						<Field label="Team size"><input type="number" className="input" value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} /></Field>
					</div>
					<Field label="Auction budget / captain"><input type="number" className="input" value={budgetPoints} onChange={(e) => setBudgetPoints(Number(e.target.value))} /></Field>
					<div className="grid grid-cols-3 gap-3">
						<Field label="Sets to win"><input type="number" className="input" value={setsToWin} onChange={(e) => setSetsToWin(Number(e.target.value))} /></Field>
						<Field label="Points / set"><input type="number" className="input" value={pointsPerSet} onChange={(e) => setPointsPerSet(Number(e.target.value))} /></Field>
						<Field label="Win by"><input type="number" className="input" value={winBy} onChange={(e) => setWinBy(Number(e.target.value))} /></Field>
					</div>
					<Field label="Playoff team count">
						<select className="input" value={playoffTeamCount} onChange={(e) => setPlayoffTeamCount(Number(e.target.value))}>
							<option value={2}>2</option>
							<option value={4}>4</option>
							<option value={8}>8</option>
						</select>
					</Field>
					{error ? <p className="text-sm text-bad">{error}</p> : null}
					<button disabled={busy} onClick={create} className="btn-primary w-fit">Create tournament →</button>
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
