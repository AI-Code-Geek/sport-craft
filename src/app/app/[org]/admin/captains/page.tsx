"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchMe, getCaptainsData, setCaptains } from "@/lib/api-client";
import { Card } from "@/components/ui";

interface Pick {
	name: string;
	color: number;
	captainUserId: string;
}

const TEAM_DOT: Record<number, string> = { 1: "bg-t1", 2: "bg-t2", 3: "bg-t3", 4: "bg-t4", 5: "bg-t5", 6: "bg-t6", 7: "bg-t7", 8: "bg-t8" };
const COLOR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AdminCaptainsPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [confirmed, setConfirmed] = useState<{ userId: string; name: string }[]>([]);
	const [maxTeams, setMaxTeams] = useState(6);
	const [budgetPoints, setBudgetPoints] = useState(100);
	const [picks, setPicks] = useState<Pick[]>([]);
	const [step, setStep] = useState<"names" | "captains">("names");
	const [alreadySaved, setAlreadySaved] = useState(false);
	const [activeIndex, setActiveIndex] = useState<number | null>(0);
	const [search, setSearch] = useState("");
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			const { data: res } = await getCaptainsData(data.tournamentId);
			setConfirmed(res.confirmed ?? []);
			setMaxTeams(res.maxTeams);
			setBudgetPoints(res.budgetPoints);
			let initial: Pick[];
			if (res.teams?.length) {
				initial = res.teams.map((t) => ({ name: t.name, color: t.color, captainUserId: t.captainUserId }));
				setAlreadySaved(true);
				setStep("captains"); // teams already exist (e.g. re-visiting) — skip straight to captains
			} else {
				initial = Array.from({ length: res.maxTeams }, (_, i) => ({ name: `Team ${i + 1}`, color: (i % 8) + 1, captainUserId: "" }));
			}
			setPicks(initial);
			const firstEmpty = initial.findIndex((p) => !p.captainUserId);
			setActiveIndex(firstEmpty === -1 ? null : firstEmpty);
		});
	}, []);

	const captainOfUser = useMemo(() => {
		const map = new Map<string, number>();
		picks.forEach((p, i) => { if (p.captainUserId) map.set(p.captainUserId, i); });
		return map;
	}, [picks]);

	function renameTeam(i: number, name: string) {
		setPicks((prev) => prev.map((p, idx) => (idx === i ? { ...p, name } : p)));
	}
	function recolorTeam(i: number, color: number) {
		setPicks((prev) => prev.map((p, idx) => (idx === i ? { ...p, color } : p)));
	}

	function pickCaptain(userId: string) {
		if (activeIndex == null) return;
		setPicks((prev) => {
			const next = prev.map((p, idx) => (idx === activeIndex ? { ...p, captainUserId: userId } : p));
			const nextEmpty = next.findIndex((p) => !p.captainUserId);
			setActiveIndex(nextEmpty === -1 ? null : nextEmpty);
			return next;
		});
	}

	function clearCaptain(i: number) {
		setPicks((prev) => prev.map((p, idx) => (idx === i ? { ...p, captainUserId: "" } : p)));
		setActiveIndex(i);
	}

	const namesValid = picks.length === maxTeams && picks.every((p) => p.name.trim().length > 0);
	const namesUnique = new Set(picks.map((p) => p.name.trim().toLowerCase())).size === picks.length;

	async function confirm() {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await setCaptains(tournamentId, picks);
		if (!ok) return setError(data.error ?? "Failed to save captains.");
		setSaved(true);
		setAlreadySaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	const nameOf = (userId: string) => confirmed.find((c) => c.userId === userId)?.name ?? userId;
	const filteredPool = confirmed.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
	const allAssigned = picks.length === maxTeams && picks.every((p) => p.captainUserId);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Teams &amp; captains</h1>
			<div className="flex items-center gap-2 text-sm">
				<StepPill n={1} label="Name your teams" active={step === "names"} done={step === "captains"} onClick={() => setStep("names")} />
				<span className="text-muted">→</span>
				<StepPill n={2} label="Pick captains" active={step === "captains"} done={false} onClick={() => namesValid && setStep("captains")} disabled={!namesValid} />
			</div>

			{step === "names" ? (
				<>
					<p className="text-sm text-muted">
						Create and name the {maxTeams} teams for this tournament. Captains are assigned in the next step, from the
						confirmed poll pool.
					</p>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{picks.map((p, i) => (
							<Card key={i}>
								<label className="mb-1.5 block text-xs text-muted">Team {i + 1} name</label>
								<input className="input mb-3" value={p.name} onChange={(e) => renameTeam(i, e.target.value)} placeholder={`Team ${i + 1}`} />
								<label className="mb-1.5 block text-xs text-muted">Color</label>
								<div className="flex flex-wrap gap-1.5">
									{COLOR_OPTIONS.map((c) => (
										<button
											key={c}
											onClick={() => recolorTeam(i, c)}
											className={`h-6 w-6 rounded-full ${TEAM_DOT[c]} ${p.color === c ? "ring-2 ring-offset-2 ring-offset-surface ring-foreground" : ""}`}
											aria-label={`Color ${c}`}
										/>
									))}
								</div>
							</Card>
						))}
					</div>
					{!namesUnique ? <p className="text-sm text-warn">Two teams have the same name — give each a unique name.</p> : null}
					<button className="btn-primary w-fit" disabled={!namesValid || !namesUnique} onClick={() => setStep("captains")}>
						Next: pick captains →
					</button>
				</>
			) : (
				<>
					<p className="text-sm text-muted">
						Click a team card, then click a polled player below to make them that team&apos;s captain. Every captain
						starts with {budgetPoints} auction points and plays under that role for this tournament only.
					</p>

					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						{picks.map((p, i) => {
							const active = activeIndex === i;
							return (
								<div
									key={i}
									onClick={() => !p.captainUserId && setActiveIndex(i)}
									className={`rounded-2xl border bg-surface p-3 transition-colors ${
										active ? "border-brand ring-2 ring-brand/15" : "border-border"
									} ${!p.captainUserId ? "cursor-pointer" : ""}`}
								>
									<div className="mb-2 flex items-center gap-2">
										<span className={`h-3 w-3 shrink-0 rounded-full ${TEAM_DOT[p.color] ?? "bg-neutral"}`} />
										<span className="flex-1 truncate font-medium">{p.name}</span>
									</div>
									{p.captainUserId ? (
										<div className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm">
											<span>👑 {nameOf(p.captainUserId)}</span>
											<button className="text-xs text-muted underline" onClick={(e) => { e.stopPropagation(); clearCaptain(i); }}>
												Change
											</button>
										</div>
									) : (
										<div className={`rounded-lg border border-dashed px-2.5 py-2 text-center text-xs ${active ? "border-brand text-brand" : "border-border text-muted"}`}>
											{active ? "Pick a player below ↓" : "Click to choose a captain"}
										</div>
									)}
								</div>
							);
						})}
					</div>

					<Card title={`Polled players (${confirmed.length} confirmed)`}>
						<input className="input mb-3" placeholder="Search players…" value={search} onChange={(e) => setSearch(e.target.value)} />
						<div className="grid max-h-96 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
							{filteredPool.map((c) => {
								const teamIdx = captainOfUser.get(c.userId);
								const taken = teamIdx != null;
								return (
									<button
										key={c.userId}
										disabled={taken || activeIndex == null}
										onClick={() => pickCaptain(c.userId)}
										className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-sm ${
											taken
												? "cursor-default border-border bg-surface-2 text-muted"
												: activeIndex == null
													? "cursor-not-allowed border-border text-muted opacity-60"
													: "border-border hover:border-brand hover:bg-brand/5"
										}`}
									>
										<span>{c.name}</span>
										{taken ? (
											<span className="flex items-center gap-1 text-xs">
												<span className={`h-2 w-2 rounded-full ${TEAM_DOT[picks[teamIdx].color] ?? "bg-neutral"}`} />
												Captain
											</span>
										) : null}
									</button>
								);
							})}
							{filteredPool.length === 0 ? <p className="col-span-full py-4 text-center text-sm text-muted">No matching players.</p> : null}
						</div>
					</Card>

					<Card>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-3 text-sm text-muted">
								<button className="underline" onClick={() => setStep("names")}>← Back to team names</button>
								<span>{confirmed.length} confirmed players · {picks.filter((p) => p.captainUserId).length} of {maxTeams} captains chosen</span>
							</div>
							<div className="flex items-center gap-2">
								{error ? <span className="text-sm text-bad">{error}</span> : null}
								{saved ? <span className="text-sm text-ok">Saved.</span> : null}
								<button className="btn-primary" disabled={!allAssigned} onClick={confirm}>
									{alreadySaved ? "Update captains →" : "Confirm captains →"}
								</button>
							</div>
						</div>
					</Card>
				</>
			)}
		</div>
	);
}

function StepPill({ n, label, active, done, onClick, disabled }: { n: number; label: string; active: boolean; done: boolean; onClick: () => void; disabled?: boolean }) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
				active ? "border-brand bg-brand/8 text-brand font-semibold" : done ? "border-ok/40 bg-ok/8 text-ok" : "border-border text-muted"
			} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
		>
			<span className="flex h-4 w-4 items-center justify-center rounded-full bg-current text-[10px] font-bold text-surface">{done ? "✓" : n}</span>
			{label}
		</button>
	);
}
