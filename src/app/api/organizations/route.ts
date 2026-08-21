import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { createCommunity, getCommunityBySlug, listCommunities } from "@/lib/community-store";
import { listUsersByCommunity, getUserById, addMembership, membershipFor } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import type { SportType, FeatureKey } from "@/lib/types";
import { FEATURE_LABELS } from "@/lib/types";
import { slugify } from "@/lib/ids";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

const VALID_SPORTS: SportType[] = ["volleyball", "basketball", "soccer", "softball", "pickleball", "other"];
const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

function normalizeFeatures(input: unknown): Record<FeatureKey, boolean> | undefined {
	if (!input || typeof input !== "object") return undefined;
	const raw = input as Record<string, unknown>;
	const out = {} as Record<FeatureKey, boolean>;
	for (const k of FEATURE_KEYS) out[k] = raw[k] === undefined ? true : !!raw[k];
	return out;
}

/** Super Admin console: every organization on the platform, with its member count and current Org Admins. */
export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);

	const communities = await listCommunities();
	const withMembers = await Promise.all(
		communities.map(async (community) => {
			const members = await listUsersByCommunity(community.id);
			const active = members.filter((u) => u.memberships.find((m) => m.communityId === community.id)?.status === "active");
			const orgAdmins = active
				.filter((u) => u.memberships.find((m) => m.communityId === community.id)?.role === "org_admin")
				.map((u) => publicUser(u, community.id));
			return { community, memberCount: active.length, orgAdmins };
		}),
	);
	return json({ organizations: withMembers });
}

/**
 * Creates a brand-new organization directly — Super Admin only, bypasses the request queue.
 * The creating Super Admin is added as that org's founding (active) Org Admin, same as an approved
 * org request would — otherwise the org would have zero members and nobody could ever manage it
 * (an Org Admin/Super Admin can only act on the org that's their session's ACTIVE membership, and
 * there's no way to become an active member of an org with nobody in it to approve you).
 */
export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);

	let body: { orgName?: string; sport?: string; features?: unknown };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const orgName = (body.orgName ?? "").trim();
	if (!orgName) return json({ error: "missing_fields" }, 400);
	const sport: SportType = VALID_SPORTS.includes(body.sport as SportType) ? (body.sport as SportType) : "volleyball";
	const features = normalizeFeatures(body.features);

	const existingOrg = await getCommunityBySlug(slugify(orgName));
	if (existingOrg) return json({ error: "org_name_taken" }, 409);

	const community = await createCommunity(orgName, sport, features);

	const caller = await getUserById(session.userid);
	if (caller && !membershipFor(caller, community.id)) {
		await addMembership(caller, community.id, "org_admin", "active");
	}

	return json({ community }, 201);
}
