/**
 * Lazy demo seed — mirrors the reference app's `ensureSeed()` pattern (a versioned marker key guards a
 * one-time bootstrap). Drives the REAL engine (poll → captains → positions → auction → schedule) so the
 * seeded state is guaranteed internally consistent, then hand-writes plausible match results for the
 * first 9 group matches (bypassing the point-by-point API purely for seed performance — one KV write
 * instead of hundreds). Runs once per fresh KV namespace / in-memory store.
 */
import { kvGetString, kvPutString } from "./kv";
import { createCommunity } from "./community-store";
import { createAccount, addMembership } from "./user-store";
import { createTournament, putTournament, getTournament } from "./tournament-store";
import { openPoll, joinPoll, closePoll } from "./poll-store";
import { setCaptainsAndNames, getTeams } from "./team-store";
import { initPositions, finalizePositions } from "./position-store";
import { startAuction, placeBid, resolveCurrent, getAuction, teamNeedsCategory } from "./auction-store";
import { generateRoundRobinSchedule, getMatches, putMatches } from "./match-store";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "./seed-client-hint";
import type { Match, SetScore, UserRecord, CommunityRole } from "./types";

/** Seed-only convenience: create an account and immediately give it an ACTIVE membership — seeded demo
 *  data bypasses the normal join-request approval queue entirely (there's no one to approve it against). */
async function seedMember(communityId: string, name: string, email: string, password: string, role: CommunityRole = "player"): Promise<UserRecord> {
	const user = await createAccount({ name, email, password });
	return addMembership(user, communityId, role, "active");
}

const SEED_MARKER = "idx:seeded:v1";
export { DEMO_ADMIN_EMAIL, DEMO_PASSWORD };

const FIRST = ["Noor", "David", "Priya", "Alex", "Jordan", "Sam", "Taylor", "Riley", "Chris", "Morgan",
	"Jamie", "Casey", "Devon", "Avery", "Reese", "Cameron", "Drew", "Skylar", "Rowan", "Hayden"];
const LAST = ["Bergstrom", "Kim", "Nair", "Santos", "Reyes", "Patel", "Okafor", "Fischer", "Costa", "Nguyen",
	"Bianchi", "Haddad", "Wallace", "Torres", "Meyer", "Alvarez", "Kowalski", "Duarte", "Hollis", "Petrov"];
function genName(i: number): string {
	return FIRST[i % FIRST.length] + " " + LAST[(i * 7 + 3) % LAST.length];
}
function genEmail(name: string, i: number): string {
	return name.toLowerCase().replace(/[^a-z]+/g, ".") + i + "@sportcraft.demo";
}

function randomSet(setNumber: number, pointsPerSet: number, winBy: number): SetScore {
	const aWins = Math.random() < 0.5;
	const margin = winBy + Math.floor(Math.random() * 10);
	let a: number, b: number;
	if (aWins) {
		a = pointsPerSet;
		b = Math.max(0, pointsPerSet - margin);
	} else {
		b = pointsPerSet;
		a = Math.max(0, pointsPerSet - margin);
	}
	return { setNumber, a, b, status: "completed" };
}

function simulateCompletedMatch(match: Match, setsToWin: number, pointsPerSet: number, winBy: number): void {
	const sets: SetScore[] = [];
	let setsA = 0, setsB = 0, n = 1;
	while (Math.max(setsA, setsB) < setsToWin) {
		const s = randomSet(n, pointsPerSet, winBy);
		sets.push(s);
		if (s.a > s.b) setsA++; else setsB++;
		n++;
	}
	match.sets = sets;
	match.status = "completed";
	match.winnerTeamId = setsA > setsB ? match.teamAId : match.teamBId;
}

// In-process lock: within one Worker isolate / dev server process, concurrent requests (e.g. the
// login POST and the Nav's parallel /api/me) can both pass the KV "already seeded?" check before
// either finishes writing — each would then run the ~30-write seed independently, producing two
// disconnected communities. A module-level promise serializes them so only the first call seeds;
// every concurrent caller awaits the SAME run. (Cross-isolate races in production are still possible
// in principle but vanishingly unlikely for a lazily-seeded demo community, and self-heal on retry.)
let seedPromise: Promise<void> | null = null;

/** Local dev only — production never auto-seeds; every org there comes from the real request/join flow. */
export async function ensureDemoSeed(): Promise<void> {
	if (process.env.NODE_ENV === "production") return;
	if (seedPromise) return seedPromise;
	seedPromise = runSeed();
	try {
		await seedPromise;
	} catch (e) {
		seedPromise = null; // allow a retry on the next call if seeding itself failed
		throw e;
	}
}

async function runSeed(): Promise<void> {
	if (await kvGetString(SEED_MARKER)) return;
	await kvPutString(SEED_MARKER, "seeding");

	const community = await createCommunity("Meridian Recreation Club");

	// The demo admin is both the platform Super Admin (account-level flag, no self-service path to get
	// this elsewhere) AND an active Org Admin of the seed community, so logging in drops them straight
	// into a fully-run demo tournament instead of an empty platform console.
	const adminAccount = await createAccount({ name: "Jordan Ellis", email: DEMO_ADMIN_EMAIL, password: DEMO_PASSWORD, isSuperAdmin: true });
	const admin = await addMembership(adminAccount, community.id, "org_admin", "active");
	const org1 = await seedMember(community.id, "David Kim", "david.kim@sportcraft.demo", DEMO_PASSWORD, "org_admin");
	const org2 = await seedMember(community.id, "Priya Nair", "priya.nair@sportcraft.demo", DEMO_PASSWORD, "org_admin");

	const voters: UserRecord[] = [];
	for (let i = 0; i < 42; i++) {
		const name = genName(i);
		const email = genEmail(name, i + 1);
		voters.push(await seedMember(community.id, name, email, DEMO_PASSWORD));
	}

	const tournament = await createTournament({
		communityId: community.id,
		name: "Meridian Summer Volleyball League 2026",
		maxTeams: 6, teamSize: 6, budgetPoints: 100,
		setsToWin: 2, pointsPerSet: 25, winBy: 2, playoffTeamCount: 4,
		createdBy: admin.userid,
	});
	void org1;
	void org2;

	await openPoll(tournament.id);
	for (const v of voters) await joinPoll(tournament.id, v.userid);
	await closePoll(tournament.id);

	const captainIdx = [0, 7, 14, 21, 28, 35];
	const teamMeta = [
		{ name: "Meridian Smashers", color: 1 },
		{ name: "Net Ninjas", color: 2 },
		{ name: "Sunset Spikers", color: 3 },
		{ name: "Block Party", color: 4 },
		{ name: "Ace Avengers", color: 5 },
		{ name: "Rally Rebels", color: 6 },
	];
	const picks = teamMeta.map((m, i) => ({ name: m.name, color: m.color, captainUserId: voters[captainIdx[i]].userid }));
	await setCaptainsAndNames(tournament.id, picks);

	await initPositions(tournament.id);
	await finalizePositions(tournament.id);

	await startAuction(tournament.id);
	for (let round = 0; round < 5; round++) {
		for (let player = 0; player < 6; player++) {
			const state = await getAuction(tournament.id);
			if (!state || !state.currentNominee) break;
			const category = state.roundOrder[state.currentRoundIndex];
			const teams = await getTeams(tournament.id);
			const eligible = teams.filter((t) => teamNeedsCategory(t, category)).sort(() => Math.random() - 0.5);
			let last = 0;
			for (const team of eligible.slice(0, 1 + Math.floor(Math.random() * 3))) {
				const bid = last + 3 + Math.floor(Math.random() * 10);
				try {
					await placeBid(tournament.id, team.id, bid);
					last = bid;
				} catch {
					// exceeded budget/reserve — skip this bidder
				}
			}
			await resolveCurrent(tournament.id);
		}
	}

	await generateRoundRobinSchedule(tournament.id, {
		venue: "Meridian Community Gym",
		courts: ["Court A", "Court B"],
		times: ["18:00", "19:15"],
		startDate: "2026-07-05",
		daysBetween: 3,
	});

	const matches = await getMatches(tournament.id);
	for (let i = 0; i < 9 && i < matches.length; i++) {
		simulateCompletedMatch(matches[i], tournament.setsToWin, tournament.pointsPerSet, tournament.winBy);
	}
	if (matches[9]) {
		matches[9].status = "live";
		matches[9].sets = [
			{ setNumber: 1, a: 25, b: 21, status: "completed" },
			{ setNumber: 2, a: 14, b: 11, status: "in_progress" },
		];
	}
	await putMatches(tournament.id, matches);

	const finalTournament = await getTournament(tournament.id);
	if (finalTournament) {
		finalTournament.status = "in_progress";
		await putTournament(finalTournament);
	}

	await kvPutString(SEED_MARKER, new Date().toISOString());
}
