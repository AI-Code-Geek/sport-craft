/**
 * Local-dev-only extra seed: a second organization ("SportCraft Club") with its own Super Admin,
 * Org Admin, and 36 active players — for testing multi-org behavior without touching the lazily
 * seeded "Meridian Recreation Club" demo data. Guarded the same way as `ensureDemoSeed` (never runs
 * in production) and marker-gated so re-running it is a no-op.
 */
import { kvGetString, kvPutString } from "./kv";
import { createCommunity, getCommunityBySlug } from "./community-store";
import { createAccount, addMembership } from "./user-store";
import { DEMO_PASSWORD } from "./seed-client-hint";
import type { UserRecord, CommunityRole } from "./types";

const SEED_MARKER = "idx:seeded:sportcraft-club:v1";
const ORG_NAME = "SportCraft Club";
export const SPORTCRAFT_CLUB_PASSWORD = DEMO_PASSWORD;
export const SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL = "superadmin@sportcraftclub.local";
export const SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL = "orgadmin@sportcraftclub.local";

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

export interface SportCraftClubSeedResult {
	alreadySeeded: boolean;
	orgSlug: string;
	superAdminEmail: string;
	orgAdminEmail: string;
	playerCount: number;
	password: string;
}

export async function ensureSportCraftClubSeed(): Promise<SportCraftClubSeedResult> {
	if (process.env.NODE_ENV === "production") throw new Error("dev_only");

	const existingMarker = await kvGetString(SEED_MARKER);
	const existingOrg = await getCommunityBySlug("sportcraft-club");
	if (existingMarker && existingOrg) {
		return {
			alreadySeeded: true,
			orgSlug: existingOrg.slug,
			superAdminEmail: SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL,
			orgAdminEmail: SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL,
			playerCount: 36,
			password: SPORTCRAFT_CLUB_PASSWORD,
		};
	}

	const community = existingOrg ?? (await createCommunity(ORG_NAME));

	const superAdminAccount = await createAccount({ name: "Sasha Whitfield", email: SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL, password: DEMO_PASSWORD, isSuperAdmin: true });
	await addMembership(superAdminAccount, community.id, "org_admin", "active");

	await seedMember(community.id, "Robin Ashford", SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL, "org_admin");

	for (let i = 0; i < 36; i++) {
		const name = genName(i);
		const email = genEmail(name, i + 1);
		await seedMember(community.id, name, email, "player");
	}

	await kvPutString(SEED_MARKER, new Date().toISOString());

	return {
		alreadySeeded: false,
		orgSlug: community.slug,
		superAdminEmail: SPORTCRAFT_CLUB_SUPER_ADMIN_EMAIL,
		orgAdminEmail: SPORTCRAFT_CLUB_ORG_ADMIN_EMAIL,
		playerCount: 36,
		password: SPORTCRAFT_CLUB_PASSWORD,
	};
}
