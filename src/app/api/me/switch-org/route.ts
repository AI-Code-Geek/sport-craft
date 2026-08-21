import { cookies } from "next/headers";
import { readSession } from "@/lib/auth-server";
import { getUserById, membershipFor, setActiveCommunity } from "@/lib/user-store";
import { signSession, SESSION_COOKIE, SESSION_MAX_SECONDS } from "@/lib/session";
import { envSecret, isProd } from "@/lib/auth-server";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Re-signs the session cookie against a different ACTIVE membership — no re-login required. */
export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);

	let body: { communityId?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.communityId) return json({ error: "missing_community_id" }, 400);

	const user = await getUserById(session.userid);
	if (!user) return json({ error: "not_found" }, 404);
	const membership = membershipFor(user, body.communityId);
	if (!membership || membership.status !== "active") return json({ error: "not_a_member" }, 403);

	await setActiveCommunity(user.userid, body.communityId);

	if (!envSecret()) return json({ error: "server_misconfigured" }, 500);
	const now = Math.floor(Date.now() / 1000);
	const exp = now + SESSION_MAX_SECONDS;
	const token = await signSession(
		{ userid: user.userid, isSuperAdmin: user.isSuperAdmin, communityId: membership.communityId, role: membership.role, exp },
		envSecret(),
	);
	const jar = await cookies();
	jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: exp - now });

	return json({ ok: true });
}
