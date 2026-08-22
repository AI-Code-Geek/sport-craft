/**
 * Matches / schedule generation / live scoring — KV key `matches:<tournamentId>` -> Match[].
 * Standings are computed on read from this array (src/lib/standings.ts) — never persisted separately,
 * so there's no derived-cache drift to worry about.
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { genMatchId } from "./ids";
import { getTournament, putTournament } from "./tournament-store";
import { getTeams } from "./team-store";
import type { Match, MatchRound } from "./types";

const key = (tournamentId: string) => `matches:${tournamentId}`;

export async function getMatches(tournamentId: string): Promise<Match[]> {
	return (await kvGetJSON<Match[]>(key(tournamentId))) ?? [];
}

export async function putMatches(tournamentId: string, matches: Match[]): Promise<void> {
	await kvPutJSON(key(tournamentId), matches);
}

export async function getMatch(tournamentId: string, matchId: string): Promise<Match | null> {
	const matches = await getMatches(tournamentId);
	return matches.find((m) => m.id === matchId) ?? null;
}

// ── Round-robin schedule generation (circle method) ─────────────────────────

/** Standard circle-method round robin: returns rounds, each an array of [teamA, teamB] pairs. */
export function roundRobinRounds(teamIds: string[]): [string, string][][] {
	const ids: (string | null)[] = [...teamIds];
	if (ids.length % 2 !== 0) ids.push(null); // bye
	const n = ids.length;
	const rounds: [string, string][][] = [];
	let arr = ids;
	for (let r = 0; r < n - 1; r++) {
		const pairs: [string, string][] = [];
		for (let i = 0; i < n / 2; i++) {
			const a = arr[i];
			const b = arr[n - 1 - i];
			if (a && b) pairs.push([a, b]);
		}
		rounds.push(pairs);
		arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
	}
	return rounds;
}

export interface ScheduleConfig {
	venue: string;
	courts: string[]; // e.g. ["Court A", "Court B"]
	times: string[]; // "HH:MM", paired index-wise with courts, cycles if more matches than courts
	startDate: string; // "YYYY-MM-DD"
	daysBetween: number; // days between each round's game day
}

function addDays(dateStr: string, days: number): string {
	const d = new Date(dateStr + "T00:00:00");
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

export async function generateRoundRobinSchedule(tournamentId: string, config: ScheduleConfig): Promise<Match[]> {
	const teams = await getTeams(tournamentId);
	if (teams.length < 2) throw new Error("not_enough_teams");
	const rounds = roundRobinRounds(teams.map((t) => t.id));
	const courts = config.courts.length ? config.courts : ["Court A"];
	const times = config.times.length ? config.times : ["18:00"];
	// Slot `k` = court[k % courts.length] at time[floor(k / courts.length) % times.length] — courts fill
	// up first (simultaneous matches on different courts at the SAME time), then the next batch bumps to
	// the next time. This guarantees no two matches in the same round ever share a (court, time) pair, as
	// long as courts.length * times.length >= the round's match count (the max is floor(teams/2)).
	function slotFor(k: number) {
		return { court: courts[k % courts.length], time: times[Math.floor(k / courts.length) % times.length] };
	}

	const matches: Match[] = [];
	rounds.forEach((pairs, roundIdx) => {
		const date = addDays(config.startDate, roundIdx * config.daysBetween);
		pairs.forEach((pair, i) => {
			const slot = slotFor(i);
			matches.push({
				id: genMatchId(),
				tournamentId,
				round: "group",
				teamAId: pair[0],
				teamBId: pair[1],
				scheduledAt: `${date}T${slot.time}:00`,
				venue: config.venue,
				court: slot.court,
				status: "scheduled",
				sets: [],
				winnerTeamId: null,
			});
		});
	});
	await putMatches(tournamentId, matches);
	const t = await getTournament(tournamentId);
	if (t) {
		t.status = "schedule_published";
		await putTournament(t);
	}
	return matches;
}

/** Append one playoff match (semifinal/final) to the schedule — used by the bracket generator. */
export async function addPlayoffMatch(
	tournamentId: string,
	input: { round: MatchRound; teamAId: string; teamBId: string; scheduledAt: string; venue: string; court: string },
): Promise<Match> {
	const matches = await getMatches(tournamentId);
	const match: Match = {
		id: genMatchId(),
		tournamentId,
		round: input.round,
		teamAId: input.teamAId,
		teamBId: input.teamBId,
		scheduledAt: input.scheduledAt,
		venue: input.venue,
		court: input.court,
		status: "scheduled",
		sets: [],
		winnerTeamId: null,
	};
	matches.push(match);
	await putMatches(tournamentId, matches);
	return match;
}

/** Edit one match's date/time, venue, or court after the schedule's been generated — doesn't touch its score. */
export async function rescheduleMatch(
	tournamentId: string,
	matchId: string,
	updates: { scheduledAt?: string; venue?: string; court?: string },
): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		if (updates.scheduledAt !== undefined) match.scheduledAt = updates.scheduledAt;
		if (updates.venue !== undefined) match.venue = updates.venue;
		if (updates.court !== undefined) match.court = updates.court;
	});
}

// ── Live scoring ──────────────────────────────────────────────────────────────

async function updateMatch(tournamentId: string, matchId: string, fn: (m: Match) => void): Promise<Match> {
	const matches = await getMatches(tournamentId);
	const match = matches.find((m) => m.id === matchId);
	if (!match) throw new Error("match_not_found");
	fn(match);
	await putMatches(tournamentId, matches);
	return match;
}

function setsWon(match: Match, side: "a" | "b"): number {
	return match.sets.filter((s) => s.status === "completed" && (side === "a" ? s.a > s.b : s.b > s.a)).length;
}

/** Marks a scheduled match live at 0-0 — lets the Org Admin start it before adding any points. A no-op if it's already live or further along. */
export async function startMatch(tournamentId: string, matchId: string): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		if (match.status !== "scheduled") return;
		match.status = "live";
		match.sets = [{ setNumber: 1, a: 0, b: 0, status: "in_progress" }];
	});
}

export async function addPoint(tournamentId: string, matchId: string, side: "a" | "b", pointsPerSet: number, winBy: number): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		if (match.status === "scheduled") match.status = "live";
		if (match.status !== "live") throw new Error("match_not_live");
		let cur = match.sets[match.sets.length - 1];
		if (!cur || cur.status === "completed") {
			cur = { setNumber: match.sets.length + 1, a: 0, b: 0, status: "in_progress" };
			match.sets.push(cur);
		}
		cur[side]++;
		if ((cur.a >= pointsPerSet || cur.b >= pointsPerSet) && Math.abs(cur.a - cur.b) >= winBy) {
			cur.status = "completed";
		}
	});
}

export async function undoPoint(tournamentId: string, matchId: string, side: "a" | "b"): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		const cur = match.sets[match.sets.length - 1];
		if (cur && cur.status === "in_progress" && cur[side] > 0) cur[side]--;
	});
}

export async function startNextSet(tournamentId: string, matchId: string, setsToWin: number): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		const last = match.sets[match.sets.length - 1];
		if (last && last.status !== "completed") throw new Error("current_set_in_progress");
		if (Math.max(setsWon(match, "a"), setsWon(match, "b")) >= setsToWin) throw new Error("match_already_decided");
		match.sets.push({ setNumber: match.sets.length + 1, a: 0, b: 0, status: "in_progress" });
	});
}

/** Undoes "End match" — reopens the last set for editing and clears the winner, so a scoring mistake
 *  can be fixed with the normal point controls and the match ended again once it's right. */
export async function reopenMatch(tournamentId: string, matchId: string): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		if (match.status !== "completed") return;
		match.status = "live";
		match.winnerTeamId = null;
		const last = match.sets[match.sets.length - 1];
		if (last && last.status === "completed") last.status = "in_progress";
	});
}

export async function endMatch(tournamentId: string, matchId: string): Promise<Match> {
	return updateMatch(tournamentId, matchId, (match) => {
		// Ending mid-set (early stoppage, forfeit, etc.) must still finalize that set with whatever
		// points it has — otherwise it stays "in_progress" forever and never counts toward sets won,
		// making a fully-scored match look like a 0-0 wipe.
		const cur = match.sets[match.sets.length - 1];
		if (cur && cur.status === "in_progress") cur.status = "completed";
		match.status = "completed";
		const a = setsWon(match, "a");
		const b = setsWon(match, "b");
		match.winnerTeamId = a === b ? null : a > b ? match.teamAId : match.teamBId;
	});
}

/** True once every `round: "group"` match is completed — the gate for opening the playoffs stage. */
export async function groupStageComplete(tournamentId: string): Promise<boolean> {
	const matches = await getMatches(tournamentId);
	const group = matches.filter((m) => m.round === "group");
	return group.length > 0 && group.every((m) => m.status === "completed");
}
