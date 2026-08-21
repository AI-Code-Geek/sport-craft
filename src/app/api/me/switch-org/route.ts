import { cookies } from "next/headers";
import { readSession } from "@/lib/auth-server";
import { getUserById, membershipFor, setActiveCommunity } from "@/lib/user-store";
import { getCommunity, getCommunityBySlug } from "@/lib/community-store";
import { signSession, SESSION_COOKIE, SESSION_MAX_SECONDS } from "@/lib/session";
import { envSecret, isProd } from "@/lib/auth-server";
import type { CommunityRole } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Re-signs the session cookie against a different org — no re-login required. A regular account needs
 * an ACTIVE membership there. A platform Super Admin can switch into ANY existing org (same bypass
 * `isSuperAdmin` already gets everywhere else — canManageTournament, the Users/Settings pages, etc.):
 * acts with their real membership role if they have one there, otherwise as an ad-hoc "org_admin".
 *
 * Accepts either `communityId` or `orgSlug` — the latter is what the `/app/<slug>/**` route layout
 * uses to keep the session in sync with the URL (see src/app/app/[org]/layout.tsx).
 */
export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);

	let body: { communityId?: string; orgSlug?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.communityId && !body.orgSlug) return json({ error: "missing_community_id" }, 400);

	const targetCommunity = body.communityId ? await getCommunity(body.communityId) : await getCommunityBySlug(body.orgSlug!);
	if (!targetCommunity) return json({ error: "not_found" }, 404);
	const communityId = targetCommunity.id;

	const user = await getUserById(session.userid);
	if (!user) return json({ error: "not_found" }, 404);

	const membership = membershipFor(user, communityId);
	let role: CommunityRole;
	if (membership?.status === "active") {
		role = membership.role;
		await setActiveCommunity(user.userid, communityId);
	} else if (user.isSuperAdmin) {
		role = "org_admin";
	} else {
		return json({ error: "not_a_member" }, 403);
	}

	if (!envSecret()) return json({ error: "server_misconfigured" }, 500);
	const now = Math.floor(Date.now() / 1000);
	const exp = now + SESSION_MAX_SECONDS;
	const token = await signSession({ userid: user.userid, isSuperAdmin: user.isSuperAdmin, communityId, role, exp }, envSecret());
	const jar = await cookies();
	jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: exp - now });

	return json({ ok: true });
}
