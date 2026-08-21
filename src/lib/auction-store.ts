/**
 * Position-based live auction engine — KV key `auction:<tournamentId>` -> AuctionState.
 * One position category is auctioned at a time: every player in that category is nominated in turn,
 * captains who still need the category bid, highest bid wins the player onto that team. Once every
 * player in the category is sold, the next category opens. (docs/DEVPLAN.md §2/§5.)
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { getTournament, putTournament } from "./tournament-store";
import { getTeams, putTeams } from "./team-store";
import { getPositions, allBucketsFull } from "./position-store";
import type { AuctionState, Team } from "./types";

const key = (tournamentId: string) => `auction:${tournamentId}`;

export async function getAuction(tournamentId: string): Promise<AuctionState | null> {
	return kvGetJSON<AuctionState>(key(tournamentId));
}

async function put(state: AuctionState): Promise<void> {
	await kvPutJSON(key(state.tournamentId), state);
}

function playersInCategory(assignment: Record<string, string>, category: string): string[] {
	return Object.entries(assignment)
		.filter(([, cat]) => cat === category)
		.map(([userId]) => userId);
}

export async function startAuction(tournamentId: string): Promise<AuctionState> {
	const t = await getTournament(tournamentId);
	if (!t) throw new Error("tournament_not_found");
	const positions = await getPositions(tournamentId);
	if (!positions) throw new Error("positions_not_set");
	if (!(await allBucketsFull(tournamentId))) throw new Error("buckets_incomplete");

	const roundOrder = positions.categories;
	const firstQueue = playersInCategory(positions.assignment, roundOrder[0]);
	const state: AuctionState = {
		tournamentId,
		status: "live",
		roundOrder,
		currentRoundIndex: 0,
		nominationQueue: firstQueue.slice(1),
		currentNominee: firstQueue[0] ?? null,
		currentBid: null,
		log: [],
	};
	await put(state);
	t.status = "auction_live";
	await putTournament(t);
	return state;
}

export async function pauseAuction(tournamentId: string): Promise<AuctionState | null> {
	const state = await getAuction(tournamentId);
	if (!state) return null;
	state.status = state.status === "paused" ? "live" : "paused";
	await put(state);
	return state;
}

/** Categories in this round still needed by a team = the team has no roster entry for that category yet. */
export function teamNeedsCategory(team: Team, category: string): boolean {
	return !team.roster.some((r) => r.position === category);
}

/** Minimum reserve: 1 point per category the team will still need to fill AFTER this one. */
function reserveAfter(state: AuctionState, team: Team): number {
	const remainingCategories = state.roundOrder
		.slice(state.currentRoundIndex + 1)
		.filter((c) => teamNeedsCategory(team, c));
	return remainingCategories.length; // 1 pt minimum reserved per future category
}

export class AuctionError extends Error {}

export async function placeBid(tournamentId: string, teamId: string, amount: number): Promise<AuctionState> {
	const state = await getAuction(tournamentId);
	if (!state || state.status !== "live") throw new AuctionError("auction_not_live");
	if (!state.currentNominee) throw new AuctionError("no_active_nominee");
	const currentCategory = state.roundOrder[state.currentRoundIndex];

	const teams = await getTeams(tournamentId);
	const team = teams.find((t) => t.id === teamId);
	if (!team) throw new AuctionError("team_not_found");
	if (!teamNeedsCategory(team, currentCategory)) throw new AuctionError("team_already_filled_this_category");

	const minAmount = (state.currentBid?.amount ?? 0) + 1;
	if (amount < minAmount) throw new AuctionError("bid_too_low");
	const reserve = reserveAfter(state, team);
	if (amount > team.budgetRemaining - reserve) throw new AuctionError("bid_exceeds_budget");

	state.currentBid = { amount, teamId };
	await put(state);
	return state;
}

/** Sell the current nominee to the current high bidder (or auto-assign at 1pt if nobody bid), then advance. */
export async function resolveCurrent(tournamentId: string): Promise<AuctionState> {
	const state = await getAuction(tournamentId);
	if (!state || state.status !== "live") throw new AuctionError("auction_not_live");
	if (!state.currentNominee) throw new AuctionError("no_active_nominee");
	const currentCategory = state.roundOrder[state.currentRoundIndex];
	const nominee = state.currentNominee;

	const teams = await getTeams(tournamentId);
	let winner = state.currentBid ? teams.find((t) => t.id === state.currentBid!.teamId) : undefined;
	let amount = state.currentBid?.amount ?? 1;

	if (!winner) {
		// No bids placed — auto-assign to the eligible team (still needs this category, has budget) with
		// the LEAST remaining budget, so no team can stall the auction by simply never bidding.
		const eligible = teams
			.filter((t) => teamNeedsCategory(t, currentCategory) && t.budgetRemaining >= 1)
			.sort((a, b) => a.budgetRemaining - b.budgetRemaining);
		winner = eligible[0];
		amount = 1;
		if (!winner) throw new AuctionError("no_eligible_team");
	}

	winner.roster.push({ userId: nominee, role: "bid", position: currentCategory, soldPrice: amount });
	winner.budgetRemaining -= amount;
	await putTeams(tournamentId, teams);

	state.log.push({ userId: nominee, teamId: winner.id, position: currentCategory, amount, result: "sold", at: new Date().toISOString() });
	state.currentBid = null;

	if (state.nominationQueue.length > 0) {
		state.currentNominee = state.nominationQueue.shift()!;
	} else {
		// Round complete — advance to the next category, or finish the auction.
		const nextIndex = state.currentRoundIndex + 1;
		if (nextIndex >= state.roundOrder.length) {
			state.status = "complete";
			state.currentNominee = null;
			await put(state);
			const t = await getTournament(tournamentId);
			if (t) {
				t.status = "auction_complete";
				await putTournament(t);
			}
			return state;
		}
		const positions = await getPositions(tournamentId);
		const nextCategory = state.roundOrder[nextIndex];
		const nextQueue = positions ? playersInCategory(positions.assignment, nextCategory) : [];
		state.currentRoundIndex = nextIndex;
		state.nominationQueue = nextQueue.slice(1);
		state.currentNominee = nextQueue[0] ?? null;
	}
	await put(state);
	return state;
}

/** Skip the current nominee to the back of this round's queue (e.g. captain temporarily unavailable). */
export async function skipNominee(tournamentId: string): Promise<AuctionState> {
	const state = await getAuction(tournamentId);
	if (!state || state.status !== "live" || !state.currentNominee) throw new AuctionError("no_active_nominee");
	if (state.currentBid) throw new AuctionError("cannot_skip_with_active_bid");
	state.nominationQueue.push(state.currentNominee);
	state.currentNominee = state.nominationQueue.shift()!;
	await put(state);
	return state;
}
