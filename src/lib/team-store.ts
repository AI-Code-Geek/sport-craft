/** Teams — KV key `teams:<tournamentId>` -> Team[] (small array, rewritten whole on every mutation). */
import { kvGetJSON, kvPutJSON } from "./kv";
import { genTeamId } from "./ids";
import { getTournament, putTournament } from "./tournament-store";
import type { Team, TournamentStatus } from "./types";

/** Lifecycle order (docs/DEVPLAN.md §5) — used to avoid ever moving `status` backward. */
const STAGE_ORDER: TournamentStatus[] = [
	"draft", "poll_open", "poll_closed", "captains_selected", "positions_set",
	"auction_live", "auction_complete", "schedule_published", "in_progress", "playoffs", "completed",
];

const key = (tournamentId: string) => `teams:${tournamentId}`;

export async function getTeams(tournamentId: string): Promise<Team[]> {
	return (await kvGetJSON<Team[]>(key(tournamentId))) ?? [];
}

export async function putTeams(tournamentId: string, teams: Team[]): Promise<void> {
	await kvPutJSON(key(tournamentId), teams);
}

export interface CaptainPick {
	name: string;
	color: number;
	captainUserId: string;
}

/**
 * Create the team shells (one per pick, captain seated, budget set) — or, when re-visiting this step
 * after teams already exist, UPDATE them in place: a pick at the same index whose captain hasn't
 * changed keeps its existing roster/budget (so fixing a team name/color after the auction has already
 * run doesn't wipe the sold players); only an actual captain change resets that team's roster to just
 * the new captain. Never moves `tournament.status` backward, either — re-saving captains after the
 * auction/schedule/scoring have already progressed must not un-gate those stages.
 */
export async function setCaptainsAndNames(tournamentId: string, picks: CaptainPick[]): Promise<Team[]> {
	const t = await getTournament(tournamentId);
	if (!t) throw new Error("tournament_not_found");
	const existing = await getTeams(tournamentId);

	const teams: Team[] = picks.map((p, i) => {
		const prior = existing[i];
		if (prior && prior.captainUserId === p.captainUserId) {
			return { ...prior, name: p.name, color: p.color };
		}
		return {
			id: prior?.id ?? genTeamId(),
			tournamentId,
			name: p.name,
			color: p.color,
			captainUserId: p.captainUserId,
			budgetTotal: t.budgetPoints,
			budgetRemaining: t.budgetPoints,
			roster: [{ userId: p.captainUserId, role: "captain", position: "Captain", soldPrice: null }],
		};
	});
	await putTeams(tournamentId, teams);

	if (STAGE_ORDER.indexOf(t.status) < STAGE_ORDER.indexOf("captains_selected")) {
		t.status = "captains_selected";
		await putTournament(t);
	}
	return teams;
}

export async function getTeam(tournamentId: string, teamId: string): Promise<Team | null> {
	const teams = await getTeams(tournamentId);
	return teams.find((tm) => tm.id === teamId) ?? null;
}

export async function findTeamOfUser(tournamentId: string, userId: string): Promise<Team | null> {
	const teams = await getTeams(tournamentId);
	return teams.find((tm) => tm.roster.some((r) => r.userId === userId)) ?? null;
}

export async function isCaptain(tournamentId: string, userId: string): Promise<Team | null> {
	const teams = await getTeams(tournamentId);
	return teams.find((tm) => tm.captainUserId === userId) ?? null;
}

export function allCaptainIds(teams: Team[]): string[] {
	return teams.map((t) => t.captainUserId);
}
