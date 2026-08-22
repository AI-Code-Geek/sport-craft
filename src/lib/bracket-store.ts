/**
 * Playoff bracket — KV key `bracket:<tournamentId>` -> Bracket. Single-elimination, seeded from
 * standings. `playoffTeamCount` must be a power of two (2, 4, or 8) so no byes are needed — a clean
 * MVP scope cut (docs/DEVPLAN.md §5). Round 0 is seeded immediately from current standings; later
 * rounds fill in (and their match gets created) as soon as both feeder matches complete.
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { getTeams } from "./team-store";
import { getMatches, addPlayoffMatch, getMatch } from "./match-store";
import { computeStandings } from "./standings";
import { getTournament, putTournament } from "./tournament-store";
import type { Bracket, BracketMatch, BracketRound, MatchRound } from "./types";

const key = (tournamentId: string) => `bracket:${tournamentId}`;

export const SUPPORTED_PLAYOFF_COUNTS = [2, 4, 8] as const;

/** Standard single-elimination seed order (1v N, 2 v N-1, …), so seed 1 & 2 only meet in the final. */
function seedOrder(size: number): number[] {
	let seeds = [1];
	while (seeds.length < size) {
		const k = seeds.length;
		const total = k * 2;
		const next: number[] = [];
		for (const s of seeds) {
			next.push(s);
			next.push(total + 1 - s);
		}
		seeds = next;
	}
	return seeds;
}

function roundName(roundsFromFinal: number): string {
	if (roundsFromFinal === 0) return "Final";
	if (roundsFromFinal === 1) return "Semifinal";
	if (roundsFromFinal === 2) return "Quarterfinal";
	return `Round of ${2 ** (roundsFromFinal + 1)}`;
}
function matchRoundKind(roundsFromFinal: number): MatchRound {
	return roundsFromFinal === 0 ? "final" : "semifinal"; // quarterfinals (8-team) still tag as "semifinal" round kind for scoring purposes
}

export async function getBracket(tournamentId: string): Promise<Bracket | null> {
	return kvGetJSON<Bracket>(key(tournamentId));
}

export interface BracketConfig {
	venue: string;
	court: string;
	/** ISO datetime per round, length = number of rounds (round 0 first). */
	dates: string[];
}

export async function generateBracket(tournamentId: string, config: BracketConfig): Promise<Bracket> {
	const t = await getTournament(tournamentId);
	if (!t) throw new Error("tournament_not_found");
	const n = t.playoffTeamCount;
	if (!SUPPORTED_PLAYOFF_COUNTS.includes(n as 2 | 4 | 8)) throw new Error("unsupported_playoff_count");

	const [teams, matches] = await Promise.all([getTeams(tournamentId), getMatches(tournamentId)]);
	const standings = computeStandings(teams, matches, t.winPoints);
	const top = standings.slice(0, n);
	if (top.length < n) throw new Error("not_enough_standings");

	const order = seedOrder(n);
	const numRounds = Math.log2(n);
	const rounds: BracketRound[] = [];

	// Round 0: both teams known immediately from seeding — create the match now.
	const round0Matches: BracketMatch[] = [];
	for (let i = 0; i < n / 2; i++) {
		const seedA = order[i * 2];
		const seedB = order[i * 2 + 1];
		const teamAId = top[seedA - 1]?.teamId ?? null;
		const teamBId = top[seedB - 1]?.teamId ?? null;
		let matchId: string | null = null;
		if (teamAId && teamBId) {
			const m = await addPlayoffMatch(tournamentId, {
				round: matchRoundKind(numRounds - 1),
				teamAId, teamBId,
				scheduledAt: config.dates[0] ?? new Date().toISOString(),
				venue: config.venue, court: config.court,
			});
			matchId = m.id;
		}
		round0Matches.push({ seedA, seedB, teamAId, teamBId, matchId });
	}
	rounds.push({ name: roundName(numRounds - 1), matches: round0Matches });

	// Later rounds: slots empty until advanceBracket() fills them from completed feeder matches.
	let prevCount = n / 2;
	for (let r = 1; r < numRounds; r++) {
		const count = prevCount / 2;
		const roundMatches: BracketMatch[] = Array.from({ length: count }, () => ({
			seedA: null, seedB: null, teamAId: null, teamBId: null, matchId: null,
		}));
		rounds.push({ name: roundName(numRounds - 1 - r), matches: roundMatches });
		prevCount = count;
	}

	const bracket: Bracket = { tournamentId, playoffTeamCount: n, provisional: false, rounds };
	await kvPutJSON(key(tournamentId), bracket);

	const tour = await getTournament(tournamentId);
	if (tour) {
		tour.status = "playoffs";
		await putTournament(tour);
	}
	return bracket;
}

/**
 * Call after any bracket match completes: propagates winners into the next round's slot, creating
 * that round's match (with the given fallback venue/court/date) once both its teams are known.
 */
export async function advanceBracket(tournamentId: string, fallback: { venue: string; court: string }): Promise<Bracket | null> {
	const bracket = await getBracket(tournamentId);
	if (!bracket) return null;

	for (let r = 0; r < bracket.rounds.length - 1; r++) {
		const round = bracket.rounds[r];
		const next = bracket.rounds[r + 1];
		for (let i = 0; i < round.matches.length; i++) {
			const bm = round.matches[i];
			if (!bm.matchId) continue;
			const match = await getMatch(tournamentId, bm.matchId);
			if (!match || match.status !== "completed" || !match.winnerTeamId) continue;
			const nextMatch = next.matches[Math.floor(i / 2)];
			const slot: "teamAId" | "teamBId" = i % 2 === 0 ? "teamAId" : "teamBId";
			if (nextMatch[slot]) continue; // already propagated
			nextMatch[slot] = match.winnerTeamId;
			const seedSlot: "seedA" | "seedB" = i % 2 === 0 ? "seedA" : "seedB";
			nextMatch[seedSlot] = i % 2 === 0 ? bm.seedA : bm.seedB;
			if (nextMatch.teamAId && nextMatch.teamBId && !nextMatch.matchId) {
				const m = await addPlayoffMatch(tournamentId, {
					round: r + 1 === bracket.rounds.length - 1 ? "final" : "semifinal",
					teamAId: nextMatch.teamAId, teamBId: nextMatch.teamBId,
					scheduledAt: new Date().toISOString(),
					venue: fallback.venue, court: fallback.court,
				});
				nextMatch.matchId = m.id;
			}
		}
	}
	await kvPutJSON(key(tournamentId), bracket);

	// Tournament complete once the final's match is completed.
	const final = bracket.rounds[bracket.rounds.length - 1].matches[0];
	if (final?.matchId) {
		const m = await getMatch(tournamentId, final.matchId);
		if (m?.status === "completed") {
			const t = await getTournament(tournamentId);
			if (t && t.status !== "completed") {
				t.status = "completed";
				await putTournament(t);
			}
		}
	}
	return bracket;
}
