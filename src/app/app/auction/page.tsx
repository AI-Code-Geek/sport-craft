"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMe, getAuction, placeBid, type AuctionView, type AuctionTeamView } from "@/lib/api-client";
import { Card, TeamChip, EmptyState } from "@/components/ui";

const BID_ERROR_MESSAGES: Record<string, string> = {
	bid_too_low: "That bid isn't higher than the current bid.",
	bid_exceeds_budget: "That exceeds your remaining budget (you need to leave enough for your team's other open positions).",
	team_already_filled_this_category: "Your team already has this position filled — you'll bid again next round.",
	no_active_nominee: "No player is currently on the block.",
	auction_not_live: "The auction isn't live right now.",
};
function friendlyBidError(code?: string): string {
	if (!code) return "Bid failed.";
	return BID_ERROR_MESSAGES[code] ?? code.replace(/_/g, " ");
}

export default function AuctionPage() {
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [captainTeamId, setCaptainTeamId] = useState<string | null>(null);
	const [auction, setAuction] = useState<AuctionView | null | undefined>(undefined);
	const [teams, setTeams] = useState<AuctionTeamView[]>([]);
	const [bidAmount, setBidAmount] = useState("");
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
			setCaptainTeamId(data.roleContext?.captainTeamId ?? null);
			await load(data.tournamentId);
			pollRef.current = setInterval(() => load(data.tournamentId!), 3000);
		});
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	async function bid(amount: number) {
		if (!tournamentId) return;
		setError("");
		const { ok, data } = await placeBid(tournamentId, amount);
		if (!ok) setError(friendlyBidError(data.error));
		await load(tournamentId);
		setBidAmount("");
	}

	if (auction === undefined) return <Card><p className="text-sm text-muted">Loading…</p></Card>;
	if (!auction) {
		return <EmptyState icon="🔨" title="Auction not started" sub="The Org Admin starts the live auction once captains are picked and every player is categorized by position." />;
	}

	const myTeam = teams.find((t) => t.id === captainTeamId);
	const canBid = !!myTeam && myTeam.needsCurrent && auction.status === "live";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Live auction</h1>
				<span className={`rounded-md px-2 py-1 text-xs font-bold uppercase ${auction.status === "live" ? "bg-bad/15 text-bad" : "bg-neutral/20 text-neutral"}`}>
					{auction.status === "live" ? "● live" : auction.status}
				</span>
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
									<div className="mt-1 text-sm text-muted">No bids yet — first eligible bid wins the floor.</div>
								)}
							</div>
						</Card>
					) : (
						<EmptyState icon="✅" title="Auction complete" sub="Every roster has been filled. Head to Teams to see the final rosters." />
					)}

					{auction.currentNominee ? (
						canBid ? (
							<Card title={`Your bid — ${myTeam!.name}`}>
								<p className="mb-2 text-xs text-muted">Remaining budget: <span className="mono font-bold">{myTeam!.budgetRemaining} pts</span></p>
								{error ? <p className="mb-2 text-xs text-bad">{error}</p> : null}
								<div className="flex flex-wrap gap-2">
									<button className="btn-outline" onClick={() => bid((auction.currentBid?.amount ?? 0) + 1)}>+1</button>
									<button className="btn-outline" onClick={() => bid((auction.currentBid?.amount ?? 0) + 5)}>+5</button>
									<button className="btn-outline" onClick={() => bid((auction.currentBid?.amount ?? 0) + 10)}>+10</button>
									<input className="input w-28" type="number" placeholder="Custom" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
									<button className="btn-primary" onClick={() => bid(Number(bidAmount))} disabled={!bidAmount}>Bid</button>
								</div>
							</Card>
						) : (
							<Card>
								<p className="text-sm text-muted">
									{myTeam
										? "Your team already has this position filled — you'll bid again next round."
										: "Only the captain whose team still needs this position can bid. Everyone else watches live."}
								</p>
							</Card>
						)
					) : null}
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
					<Card title="Up next this round">
						{auction.nominationQueueNames.length ? (
							<div className="flex flex-col gap-1 text-sm">
								{auction.nominationQueueNames.map((n, i) => (
									<div key={i} className="flex justify-between">
										<span>{n}</span>
										<span className="text-xs text-muted">{auction.currentCategory}</span>
									</div>
								))}
							</div>
						) : (
							<span className="text-sm text-muted">Last player in this round&apos;s category.</span>
						)}
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
