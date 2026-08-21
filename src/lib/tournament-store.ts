/**
 * Tournament CRUD + organizer assignment. KV keys:
 *   `tournament:<id>` -> Tournament
 *   `idx:community-tournaments:<communityId>` -> id[]  (creation order; last = "active" tournament)
 *   `organizers:<tournamentId>` -> userId[]
 */
import { kvGetJSON, kvPutJSON, idxAppend, idxList } from "./kv";
import { genTournamentId } from "./ids";
import type { Tournament, TournamentStatus } from "./types";

const key = (id: string) => `tournament:${id}`;
const communityIndex = (communityId: string) => `idx:community-tournaments:${communityId}`;
const organizersKey = (tournamentId: string) => `organizers:${tournamentId}`;

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
		playoffTeamCount: input.playoffTeamCount,
		pollOpenedAt: null,
		pollClosedAt: null,
		createdBy: input.createdBy,
		createdAt: new Date().toISOString(),
	};
	await kvPutJSON(key(t.id), t);
	await idxAppend(communityIndex(input.communityId), t.id);
	await kvPutJSON(organizersKey(t.id), [input.createdBy]);
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

// ── Organizers ────────────────────────────────────────────────────────────────

export async function getOrganizers(tournamentId: string): Promise<string[]> {
	return (await kvGetJSON<string[]>(organizersKey(tournamentId))) ?? [];
}

export async function addOrganizer(tournamentId: string, userId: string): Promise<string[]> {
	const list = await getOrganizers(tournamentId);
	if (!list.includes(userId)) list.push(userId);
	await kvPutJSON(organizersKey(tournamentId), list);
	return list;
}

export async function removeOrganizer(tournamentId: string, userId: string): Promise<string[]> {
	const list = (await getOrganizers(tournamentId)).filter((id) => id !== userId);
	await kvPutJSON(organizersKey(tournamentId), list);
	return list;
}

export async function isOrganizer(tournamentId: string, userId: string): Promise<boolean> {
	return (await getOrganizers(tournamentId)).includes(userId);
}
