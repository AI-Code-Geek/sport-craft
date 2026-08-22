/**
 * Tournament CRUD. KV keys:
 *   `tournament:<id>` -> Tournament
 *   `idx:community-tournaments:<communityId>` -> id[]  (creation order; last = "active" tournament)
 *
 * Who may manage a tournament is derived from the org's own Org Admin membership (see authz.ts /
 * user-store.ts) — there is no per-tournament assignment list any more.
 */
import { kvGetJSON, kvPutJSON, kvDelete, idxAppend, idxList, idxRemove } from "./kv";
import { genTournamentId } from "./ids";
import type { Tournament, TournamentStatus } from "./types";

const key = (id: string) => `tournament:${id}`;
const communityIndex = (communityId: string) => `idx:community-tournaments:${communityId}`;

export interface CreateTournamentInput {
	communityId: string;
	name: string;
	maxTeams: number;
	teamSize: number;
	budgetPoints: number;
	pollCapacity?: number;
	setsToWin: number;
	pointsPerSet: number;
	winBy: number;
	winPoints?: number;
	playoffTeamCount: number;
	createdBy: string;
}

export async function createTournament(input: CreateTournamentInput): Promise<Tournament> {
	const t: Tournament = {
		id: genTournamentId(),
		communityId: input.communityId,
		name: input.name,
		status: "draft",
		maxTeams: input.maxTeams,
		teamSize: input.teamSize,
		budgetPoints: input.budgetPoints,
		pollCapacity: input.pollCapacity ?? input.maxTeams * input.teamSize,
		setsToWin: input.setsToWin,
		pointsPerSet: input.pointsPerSet,
		winBy: input.winBy,
		winPoints: input.winPoints ?? 2,
		playoffTeamCount: input.playoffTeamCount,
		pollOpenedAt: null,
		pollClosedAt: null,
		createdBy: input.createdBy,
		createdAt: new Date().toISOString(),
		guidelines: null,
	};
	await kvPutJSON(key(t.id), t);
	await idxAppend(communityIndex(input.communityId), t.id);
	return t;
}

export async function getTournament(id: string): Promise<Tournament | null> {
	return kvGetJSON<Tournament>(key(id));
}

export async function listTournamentsByCommunity(communityId: string): Promise<Tournament[]> {
	const ids = await idxList(communityIndex(communityId));
	const list = await Promise.all(ids.map(getTournament));
	return list.filter((t): t is Tournament => !!t);
}

/** The community's most-recently-created tournament — the single "active" one the /app/* pages operate on (v1 scope). */
export async function getActiveTournament(communityId: string): Promise<Tournament | null> {
	const ids = await idxList(communityIndex(communityId));
	if (ids.length === 0) return null;
	return getTournament(ids[ids.length - 1]);
}

export async function putTournament(t: Tournament): Promise<void> {
	await kvPutJSON(key(t.id), t);
}

export async function setTournamentStatus(id: string, status: TournamentStatus): Promise<Tournament | null> {
	const t = await getTournament(id);
	if (!t) return null;
	t.status = status;
	await putTournament(t);
	return t;
}

/**
 * Deletes a tournament and every KV blob scoped to it (poll, teams, positions, auction, matches,
 * bracket, notifications) — irreversible. If it was the community's active (most recent) tournament,
 * whichever one is now last in the index becomes active, same as if this one had never existed.
 */
export async function deleteTournament(id: string): Promise<boolean> {
	const t = await getTournament(id);
	if (!t) return false;
	await Promise.all([
		kvDelete(key(id)),
		kvDelete(`poll:${id}`),
		kvDelete(`teams:${id}`),
		kvDelete(`positions:${id}`),
		kvDelete(`auction:${id}`),
		kvDelete(`matches:${id}`),
		kvDelete(`bracket:${id}`),
		kvDelete(`notifications:${id}`),
		idxRemove(communityIndex(t.communityId), id),
	]);
	return true;
}
