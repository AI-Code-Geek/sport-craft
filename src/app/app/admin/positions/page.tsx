"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, getPositions, assignPosition, finalizePositions } from "@/lib/api-client";
import type { PositionPlayerView } from "@/lib/api-client";
import { Card, Meter } from "@/components/ui";

export default function AdminPositionsPage() {
	const router = useRouter();
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [players, setPlayers] = useState<PositionPlayerView[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [counts, setCounts] = useState<Record<string, number>>({});
	const [target, setTarget] = useState(6);
	const [allFull, setAllFull] = useState(false);
	const [error, setError] = useState("");
	const [dragUserId, setDragUserId] = useState<string | null>(null);
	const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

	async function load(tid: string) {
		const { data } = await getPositions(tid);
		setPlayers(data.players ?? []);
		setCategories(data.positions?.categories ?? []);
		setCounts(data.counts ?? {});
		setTarget(data.target ?? 6);
		setAllFull(data.allFull ?? false);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return;
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
		});
	}, []);

	async function changeCategory(userId: string, category: string) {
		if (!tournamentId) return;
		// Optimistic move so the card feels instant instead of waiting on the round trip.
		setPlayers((prev) => prev.map((p) => (p.userId === userId ? { ...p, category } : p)));
		await assignPosition(tournamentId, userId, category);
		await load(tournamentId);
	}

	async function startAuctionFlow() {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await finalizePositions(tournamentId);
		if (!ok) return setError(data.error ?? "Buckets aren't full yet.");
		router.push("/app/admin/auction");
	}

	const byCategory = useMemo(() => {
		const map: Record<string, PositionPlayerView[]> = {};
		for (const c of categories) map[c] = [];
		for (const p of players) if (p.category) (map[p.category] ??= []).push(p);
		return map;
	}, [categories, players]);

	function onDrop(category: string) {
		setDragOverCategory(null);
		if (dragUserId) changeCategory(dragUserId, category);
		setDragUserId(null);
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Categorize players by position</h1>
			<p className="text-sm text-muted">
				Drag a player onto the position card they play, or use the picker on their chip. Each card needs exactly {target} players (one per team) before the auction can start.
			</p>

			{players.length === 0 ? (
				<Card>
					<p className="py-6 text-center text-muted">No confirmed players yet — captains must be picked first.</p>
				</Card>
			) : (
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
					{categories.map((c) => {
						const list = byCategory[c] ?? [];
						const n = list.length;
						const full = n === target;
						const over = dragOverCategory === c;
						return (
							<div
								key={c}
								onDragOver={(e) => {
									e.preventDefault();
									setDragOverCategory(c);
								}}
								onDragLeave={() => setDragOverCategory((cur) => (cur === c ? null : cur))}
								onDrop={(e) => {
									e.preventDefault();
									onDrop(c);
								}}
								className={`flex min-h-[220px] flex-col rounded-2xl border bg-surface transition-colors ${
									over ? "border-brand bg-brand/5" : "border-border"
								}`}
							>
								<div className="flex items-center justify-between border-b border-border px-3 py-2.5">
									<span className="text-sm font-semibold">{c}</span>
									<span className={`text-xs font-bold ${full ? "text-ok" : "text-warn"}`}>{n}/{target}{full ? " ✓" : ""}</span>
								</div>
								<div className="px-2 pb-1 pt-2">
									<Meter pct={(100 * n) / target} thin />
								</div>
								<div className="flex flex-1 flex-col gap-1.5 p-2">
									{list.map((p) => (
										<div
											key={p.userId}
											draggable
											onDragStart={(e) => {
												setDragUserId(p.userId);
												e.dataTransfer.effectAllowed = "move";
												e.dataTransfer.setData("text/plain", p.userId);
											}}
											onDragEnd={() => setDragUserId(null)}
											className={`flex cursor-grab items-center justify-between gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs active:cursor-grabbing ${
												dragUserId === p.userId ? "opacity-40" : ""
											}`}
											title="Drag onto another card to move them"
										>
											<span className="truncate">{p.name}</span>
											<select
												aria-label={`Move ${p.name}`}
												className="shrink-0 rounded border border-border bg-surface px-1 py-0.5 text-[11px]"
												value={p.category ?? ""}
												onChange={(e) => changeCategory(p.userId, e.target.value)}
											>
												{categories.map((cat) => (
													<option key={cat} value={cat}>{cat}</option>
												))}
											</select>
										</div>
									))}
									{list.length === 0 ? (
										<div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-6 text-xs text-muted">
											Drop a player here
										</div>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
			)}

			<div className="flex items-center gap-3">
				{error ? <span className="text-sm text-bad">{error}</span> : null}
				<button className="btn-primary" disabled={!allFull} onClick={startAuctionFlow}>Start auction →</button>
				{!allFull && players.length > 0 ? <span className="text-xs text-muted">Every card needs to read {target}/{target} first.</span> : null}
			</div>
		</div>
	);
}
