import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { createCommunity, getCommunityBySlug, listCommunities } from "@/lib/community-store";
import { listUsersByCommunity } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import type { SportType } from "@/lib/types";
import { slugify } from "@/lib/ids";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

const VALID_SPORTS: SportType[] = ["volleyball", "basketball", "soccer", "softball", "pickleball", "other"];

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

/** Creates a brand-new organization. Super Admin only — no self-service path exists. */
export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);

	let body: { orgName?: string; sport?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const orgName = (body.orgName ?? "").trim();
	if (!orgName) return json({ error: "missing_fields" }, 400);
	const sport: SportType = VALID_SPORTS.includes(body.sport as SportType) ? (body.sport as SportType) : "volleyball";

	const existingOrg = await getCommunityBySlug(slugify(orgName));
	if (existingOrg) return json({ error: "org_name_taken" }, 409);

	const community = await createCommunity(orgName, sport);
	return json({ community }, 201);
}
