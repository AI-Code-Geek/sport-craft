/**
 * Local-dev-only extra seed: a second organization ("SportCraft Club") with its own Super Admin,
 * Org Admin, and 36 active players — for testing multi-org behavior without touching the lazily
 * seeded "Meridian Recreation Club" demo data. Guarded the same way as `ensureDemoSeed` (never runs
 * in production).
 *
 * Unlike the one-shot Meridian seed, this one is a resumable state machine: each call names a target
 * `Stage` and advances from wherever it last stopped (org+users only, by default) up through that
 * stage of the real tournament lifecycle — poll vote, poll close, captains, positions, auction,
 * schedule, live scoring, playoffs — driving the actual domain functions so the data stays internally
 * consistent, same as the Meridian seed. Re-requesting an already-reached (or earlier) stage is a
 * no-op; requesting a later one just continues from where it left off.
 */
import { kvGetJSON, kvGetString, kvPutJSON } from "./kv";
import { createCommunity, getCommunityBySlug } from "./community-store";
import { createAccount, addMembership, listUsersByCommunity } from "./user-store";
import { createTournament, getTournament, putTournament } from "./tournament-store";
import { openPoll, joinPoll, closePoll } from "./poll-store";
import { setCaptainsAndNames, getTeams } from "./team-store";
import { initPositions, finalizePositions } from "./position-store";
import { startAuction, placeBid, resolveCurrent, getAuction, teamNeedsCategory } from "./auction-store";
import { generateRoundRobinSchedule, getMatches, putMatches } from "./match-store";
import { generateBracket } from "./bracket-store";
import { simulateCompletedMatch } from "./seed-fixtures";
import { DEMO_PASSWORD } from "./seed-client-hint";
import type { UserRecord, CommunityRole } from "./types";

const STATE_KEY = "idx:seeded:sportcraft-club:v2";
const LEGACY_MARKER = "idx:seeded:sportcraft-club:v1"; // pre-stage version: just org + users
const ORG_NAME = "SportCraft Club";
export const SPORTCRAFT_CLUB_PASSWORD = DEMO_PASSWORD;
export const SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL = "superadmin@sportcraftclub.local";
export const SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL = "orgadmin@sportcraftclub.local";

export const STAGE_ORDER = ["users", "vote", "poll-closed", "captains", "positions", "auction", "schedule", "live", "playoffs"] as const;
export type Stage = (typeof STAGE_ORDER)[number];

function isStage(s: string): s is Stage {
	return (STAGE_ORDER as readonly string[]).includes(s);
}

interface SeedState {
	communityId: string;
	tournamentId: string | null;
	stage: Stage;
}

const FIRST = ["Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Rowan", "Skyler", "Emerson",
	"Hayden", "Peyton", "Dakota", "Reagan", "Finley", "Sawyer", "Ellis", "Marlowe", "Remy", "Blair"];
const LAST = ["Whitfield", "Ashford", "Calloway", "Doyle", "Ferraro", "Grantham", "Holloway", "Ibarra", "Jansen", "Keswick",
	"Lindqvist", "Marchetti", "Novak", "Osei", "Prescott", "Quintero", "Rossum", "Sabatini", "Trench", "Vargas"];
function genName(i: number): string {
	return FIRST[i % FIRST.length] + " " + LAST[(i * 5 + 2) % LAST.length];
}
function genEmail(name: string, i: number): string {
	return name.toLowerCase().replace(/[^a-z]+/g, ".") + i + "@sportcraftclub.local";
}

async function seedMember(communityId: string, name: string, email: string, role: CommunityRole = "player"): Promise<UserRecord> {
	const user = await createAccount({ name, email, password: DEMO_PASSWORD });
	return addMembership(user, communityId, role, "active");
}

async function loadState(): Promise<SeedState | null> {
	const state = await kvGetJSON<SeedState>(STATE_KEY);
	if (state) return state;
	// Migrate from the pre-stage marker: org + users existed, no tournament yet.
	const legacy = await kvGetString(LEGACY_MARKER);
	const org = await getCommunityBySlug("sportcraft-club");
	if (legacy && org) return { communityId: org.id, tournamentId: null, stage: "users" };
	return null;
}

async function saveState(state: SeedState): Promise<void> {
	await kvPutJSON(STATE_KEY, state);
}

async function createOrgAndUsers(): Promise<SeedState> {
	const community = (await getCommunityBySlug("sportcraft-club")) ?? (await createCommunity(ORG_NAME));

	const superAdminAccount = await createAccount({ name: "Sasha Whitfield", email: SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL, password: DEMO_PASSWORD, isSuperAdmin: true });
	await addMembership(superAdminAccount, community.id, "org_admin", "active");
	await seedMember(community.id, "Robin Ashford", SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL, "org_admin");

	for (let i = 0; i < 36; i++) {
		const name = genName(i);
		const email = genEmail(name, i + 1);
		await seedMember(community.id, name, email, "player");
	}

	return { communityId: community.id, tournamentId: null, stage: "users" };
}

const TEAM_META = [
	{ name: "Harbor Hammers", color: 1 },
	{ name: "Iron Setters", color: 2 },
	{ name: "Coastal Crush", color: 3 },
	{ name: "Thunder Spikers", color: 4 },
	{ name: "Vantage Volley", color: 5 },
	{ name: "Ridgeline Rally", color: 6 },
];

async function advanceOneStage(state: SeedState): Promise<SeedState> {
	const players = (await listUsersByCommunity(state.communityId)).filter((u) => u.email.endsWith("@sportcraftclub.local") && u.email !== SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL && u.email !== SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL);

	switch (state.stage) {
		case "users": {
			const admin = (await listUsersByCommunity(state.communityId)).find((u) => u.email === SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL)!;
			const tournament = await createTournament({
				communityId: state.communityId,
				name: "SportCraft Club Season Opener",
				maxTeams: 6, teamSize: 6, budgetPoints: 100,
				setsToWin: 2, pointsPerSet: 25, winBy: 2, playoffTeamCount: 4,
				createdBy: admin.userid,
			});
			await openPoll(tournament.id);
			for (const p of players) await joinPoll(tournament.id, p.userid);
			return { ...state, tournamentId: tournament.id, stage: "vote" };
		}
		case "vote": {
			await closePoll(state.tournamentId!);
			return { ...state, stage: "poll-closed" };
		}
		case "poll-closed": {
			const captainIdx = [0, 6, 12, 18, 24, 30];
			const picks = TEAM_META.map((m, i) => ({ name: m.name, color: m.color, captainUserId: players[captainIdx[i]].userid }));
			await setCaptainsAndNames(state.tournamentId!, picks);
			return { ...state, stage: "captains" };
		}
		case "captains": {
			await initPositions(state.tournamentId!);
			await finalizePositions(state.tournamentId!);
			return { ...state, stage: "positions" };
		}
		case "positions": {
			const tid = state.tournamentId!;
			await startAuction(tid);
			for (let round = 0; round < 5; round++) {
				for (let player = 0; player < 6; player++) {
					const auctionState = await getAuction(tid);
					if (!auctionState || !auctionState.currentNominee) break;
					const category = auctionState.roundOrder[auctionState.currentRoundIndex];
					const teams = await getTeams(tid);
					const eligible = teams.filter((t) => teamNeedsCategory(t, category)).sort(() => Math.random() - 0.5);
					let last = 0;
					for (const team of eligible.slice(0, 1 + Math.floor(Math.random() * 3))) {
						const bid = last + 3 + Math.floor(Math.random() * 10);
						try {
							await placeBid(tid, team.id, bid);
							last = bid;
						} catch {
							// exceeded budget/reserve — skip this bidder
						}
					}
					await resolveCurrent(tid);
				}
			}
			return { ...state, stage: "auction" };
		}
		case "auction": {
			await generateRoundRobinSchedule(state.tournamentId!, {
				venue: "SportCraft Club Fieldhouse",
				courts: ["Court 1", "Court 2"],
				times: ["17:00", "18:15"],
				startDate: "2026-06-01",
				daysBetween: 3,
			});
			return { ...state, stage: "schedule" };
		}
		case "schedule": {
			const tid = state.tournamentId!;
			const t = await getTournament(tid);
			if (!t) throw new Error("tournament_not_found");
			const matches = await getMatches(tid);
			for (let i = 0; i < 9 && i < matches.length; i++) {
				simulateCompletedMatch(matches[i], t.setsToWin, t.pointsPerSet, t.winBy);
			}
			if (matches[9]) {
				matches[9].status = "live";
				matches[9].sets = [
					{ setNumber: 1, a: 25, b: 21, status: "completed" },
					{ setNumber: 2, a: 14, b: 11, status: "in_progress" },
				];
			}
			await putMatches(tid, matches);
			t.status = "in_progress";
			await putTournament(t);
			return { ...state, stage: "live" };
		}
		case "live": {
			const tid = state.tournamentId!;
			const t = await getTournament(tid);
			if (!t) throw new Error("tournament_not_found");
			const matches = await getMatches(tid);
			for (const m of matches) {
				if (m.status !== "completed") simulateCompletedMatch(m, t.setsToWin, t.pointsPerSet, t.winBy);
			}
			await putMatches(tid, matches);
			await generateBracket(tid, {
				venue: "SportCraft Club Fieldhouse",
				court: "Court 1",
				dates: ["2026-07-10T18:00:00", "2026-07-17T18:00:00", "2026-07-24T18:00:00"],
			});
			t.status = "playoffs";
			await putTournament(t);
			return { ...state, stage: "playoffs" };
		}
		case "playoffs":
			return state; // already at the end of the line
	}
}

export interface SportCraftClubSeedResult {
	stage: Stage;
	orgSlug: string;
	tournamentId: string | null;
	superAdminEmail: string;
	orgAdminEmail: string;
	playerCount: number;
	password: string;
}

export async function ensureSportCraftClubSeed(targetStageInput: string): Promise<SportCraftClubSeedResult> {
	if (process.env.NODE_ENV === "production") throw new Error("dev_only");
	const targetStage: Stage = isStage(targetStageInput) ? targetStageInput : "users";

	let state = await loadState();
	if (!state) state = await createOrgAndUsers();
	await saveState(state);

	const targetIdx = STAGE_ORDER.indexOf(targetStage);
	while (STAGE_ORDER.indexOf(state.stage) < targetIdx) {
		state = await advanceOneStage(state);
		await saveState(state);
	}

	const org = await getCommunityBySlug("sportcraft-club");
	return {
		stage: state.stage,
		orgSlug: org?.slug ?? "sportcraft-club",
		tournamentId: state.tournamentId,
		superAdminEmail: SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL,
		orgAdminEmail: SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL,
		playerCount: 36,
		password: SPORTCRAFT_CLUB_PASSWORD,
	};
}
