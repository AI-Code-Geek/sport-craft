"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMe, getAuction, auctionAction, resolveAuction, skipNominee, type AuctionView, type AuctionTeamView } from "@/lib/api-client";
import { Card, TeamChip, EmptyState } from "@/components/ui";

const ADMIN_AUCTION_ERROR_MESSAGES: Record<string, string> = {
	forbidden: "You don't have permission to manage this auction.",
	unauthorized: "Your session has expired — please sign in again.",
	not_found: "This tournament couldn't be found.",
	bad_request: "That request couldn't be processed.",
	invalid_action: "That action isn't supported.",
	auction_not_live: "The auction isn't live right now.",
	no_active_nominee: "No player is currently on the block.",
	no_eligible_team: "No team is eligible to receive this player.",
	cannot_skip_with_active_bid: "There's an active bid — resolve it before skipping.",
};
function friendlyAdminAuctionError(code: string | undefined, fallback: string): string {
	if (!code) return fallback;
	return ADMIN_AUCTION_ERROR_MESSAGES[code] ?? code.replace(/_/g, " ");
}

export default function AdminAuctionPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [auction, setAuction] = useState<AuctionView | null | undefined>(undefined);
	const [teams, setTeams] = useState<AuctionTeamView[]>([]);
	const [error, setError] = useState("");
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	async function load(tid: string) {
		const { data } = await getAuction(tid);
		setAuction(data.auction ?? null);
		setTeams(data.teams ?? []);
	}

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			if (!data.tournamentId) return setAuction(null);
			setTournamentId(data.tournamentId);
			await load(data.tournamentId);
			pollRef.current = setInterval(() => load(data.tournamentId!), 3000);
		});
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	async function start() {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await auctionAction(tournamentId, "start");
		if (!ok) setError(friendlyAdminAuctionError(data.error, "Could not start the auction."));
		await load(tournamentId);
	}
	async function pause() {
		if (!tournamentId) return;
		await auctionAction(tournamentId, "pause");
		await load(tournamentId);
	}
	async function markSold() {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await resolveAuction(tournamentId);
		if (!ok) setError(friendlyAdminAuctionError(data.error, "Could not resolve."));
		await load(tournamentId);
	}
	async function skip() {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await skipNominee(tournamentId);
		if (!ok) setError(friendlyAdminAuctionError(data.error, "Could not skip."));
		await load(tournamentId);
	}

	if (auction === undefined) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

	if (!auction) {
		return (
			<div className="flex flex-col gap-4">
				<h1 className="text-xl font-bold">Auction control</h1>
				<EmptyState
					icon="🔨"
					title="Auction not started"
					sub="Finish position categorization first, then start the live auction from here."
					action={<button className="btn-primary mt-2" onClick={start}>Start auction →</button>}
				/>
				{error ? <p className="text-center text-sm text-bad">{error}</p> : null}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Auction control</h1>
				<div className="flex gap-2">
					<button className="btn-outline" onClick={pause}>{auction.status === "paused" ? "Resume" : "Pause"}</button>
					<button className="btn-danger" onClick={markSold} disabled={!auction.currentBid}>Force-resolve</button>
				</div>
			</div>

			<Card>
				<div className="flex flex-wrap gap-2">
					{auction.roundsCompleted.map((r) => (
						<div key={r} className="min-w-[110px] flex-1 rounded-xl border border-ok/40 bg-ok/8 px-3 py-2 text-sm">
							<div className="font-semibold text-ok">✓ {r}</div>
							<div className="text-xs text-muted">complete</div>
						</div>
					))}
					{auction.currentCategory ? (
						<div className="min-w-[110px] flex-1 rounded-xl border border-brand bg-brand/8 px-3 py-2 text-sm ring-2 ring-brand/15">
							<div className="font-semibold text-brand">▶ {auction.currentCategory}</div>
							<div className="text-xs text-muted">live now</div>
						</div>
					) : null}
					{auction.roundsRemaining.map((r) => (
						<div key={r} className="min-w-[110px] flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
							<div className="font-semibold">{r}</div>
							<div className="text-xs text-muted">queued</div>
						</div>
					))}
				</div>
			</Card>

			{error ? <p className="text-sm text-bad">{error}</p> : null}

			<div className="grid gap-4 lg:grid-cols-[1fr_380px]">
				<div className="flex flex-col gap-4">
					{auction.currentNominee ? (
						<Card>
							<div className="flex flex-col items-center gap-1 py-3 text-center">
								<div className="text-xs font-semibold tracking-wide text-muted uppercase">{auction.currentCategory} · on the block</div>
								<div className="text-2xl font-extrabold">{auction.currentNomineeName}</div>
								<div className="mono mt-1 text-4xl font-black text-brand">{auction.currentBid?.amount ?? 0} pts</div>
								{auction.currentBid ? (
									<div className="mt-1 text-sm">
										{(() => {
											const t = teams.find((x) => x.id === auction.currentBid!.teamId);
											return t ? <TeamChip id={t.id} name={t.name} color={t.color} link={false} /> : auction.currentBid.teamId;
										})()}{" "}
										is high bidder
									</div>
								) : (
									<div className="mt-1 text-sm text-muted">No bids yet.</div>
								)}
							</div>
						</Card>
					) : (
						<EmptyState icon="✅" title="Auction complete" sub="Every roster has been filled." />
					)}
					<Card title="Manual controls">
						<div className="flex flex-wrap gap-2">
							<button className="btn-secondary" onClick={markSold} disabled={!auction.currentNominee}>Mark sold →</button>
							<button className="btn-outline" onClick={skip} disabled={!auction.currentNominee || !!auction.currentBid}>Skip nominee</button>
						</div>
					</Card>
				</div>

				<div className="flex flex-col gap-4">
					<Card title="Team budgets">
						<div className="flex flex-col divide-y divide-border">
							{teams.map((t) => (
								<div key={t.id} className="flex items-center gap-2 py-2 text-sm">
									<span className="flex-1"><TeamChip id={t.id} name={t.name} color={t.color} link={false} /></span>
									<span className="text-xs text-muted">{t.filled}/5 slots</span>
									<span className="mono font-bold">{t.budgetRemaining} pts</span>
								</div>
							))}
						</div>
					</Card>
					<Card title="Bid log">
						<div className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto text-sm">
							{auction.log.map((l, i) => {
								const t = teams.find((x) => x.id === l.teamId);
								return (
									<div key={i} className="flex items-center justify-between py-1.5">
										<span>{l.name} <span className="text-xs text-muted">({l.position})</span></span>
										<span className="flex items-center gap-1.5">
											{t ? <TeamChip id={t.id} name={t.name} color={t.color} link={false} /> : l.teamId}
											<span className="mono">{l.amount}</span>
											<span className="text-xs text-ok">sold</span>
										</span>
									</div>
								);
							})}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
