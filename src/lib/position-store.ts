/**
 * Position categorization — KV key `positions:<tournamentId>` -> PositionsState.
 * The organizing committee sorts every confirmed non-captain player into one category per remaining
 * roster slot (teamSize - 1 categories); each category must end up with exactly `maxTeams` players
 * before the auction can start (docs/DEVPLAN.md §2/§5).
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { getTournament, putTournament } from "./tournament-store";
import { getTeams } from "./team-store";
import { getPoll } from "./poll-store";
import { defaultPositions } from "./types";
import type { PositionsState } from "./types";

const key = (tournamentId: string) => `positions:${tournamentId}`;

export async function getPositions(tournamentId: string): Promise<PositionsState | null> {
	return kvGetJSON<PositionsState>(key(tournamentId));
}

/** Pool of confirmed players still needing a category: confirmed poll entries minus every captain. */
export async function remainingPlayerPool(tournamentId: string): Promise<string[]> {
	const [poll, teams] = await Promise.all([getPoll(tournamentId), getTeams(tournamentId)]);
	const confirmed = (poll?.entries ?? []).filter((e) => e.status === "confirmed").map((e) => e.userId);
	const captainIds = new Set(teams.map((t) => t.captainUserId));
	return confirmed.filter((id) => !captainIds.has(id));
}

/** Initialize (or reset) the categorization state for this tournament's remaining pool. */
export async function initPositions(tournamentId: string): Promise<PositionsState> {
	const t = await getTournament(tournamentId);
	if (!t) throw new Error("tournament_not_found");
	const pool = await remainingPlayerPool(tournamentId);
	const categories = defaultPositions(t.teamSize);
	const existing = await getPositions(tournamentId);
	// Preserve any assignments already made for players still in the pool; auto-round-robin the rest
	// as a starting point so the committee edits rather than assigns from a blank slate.
	const assignment: Record<string, string> = {};
	pool.forEach((userId, i) => {
		assignment[userId] = existing?.assignment?.[userId] ?? categories[i % categories.length];
	});
	const state: PositionsState = { tournamentId, categories, assignment };
	await kvPutJSON(key(tournamentId), state);
	return state;
}

export async function assignPosition(tournamentId: string, userId: string, category: string): Promise<PositionsState> {
	const state = (await getPositions(tournamentId)) ?? (await initPositions(tournamentId));
	if (!state.categories.includes(category)) throw new Error("invalid_category");
	state.assignment[userId] = category;
	await kvPutJSON(key(tournamentId), state);
	return state;
}

export function bucketCounts(state: PositionsState): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const c of state.categories) counts[c] = 0;
	for (const cat of Object.values(state.assignment)) counts[cat] = (counts[cat] ?? 0) + 1;
	return counts;
}

export async function allBucketsFull(tournamentId: string): Promise<boolean> {
	const [t, state] = await Promise.all([getTournament(tournamentId), getPositions(tournamentId)]);
	if (!t || !state) return false;
	const counts = bucketCounts(state);
	return state.categories.every((c) => counts[c] === t.maxTeams);
}

export async function finalizePositions(tournamentId: string): Promise<void> {
	const t = await getTournament(tournamentId);
	if (!t) throw new Error("tournament_not_found");
	t.status = "positions_set";
	await putTournament(t);
}
