import { cookies } from "next/headers";
import { ensureDemoSeed } from "@/lib/seed";
import { getCommunityByInviteCode } from "@/lib/community-store";
import { registerUser } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { signSession, SESSION_COOKIE, SESSION_MAX_SECONDS } from "@/lib/session";
import { envSecret, isProd } from "@/lib/auth-server";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
	await ensureDemoSeed();

	let body: { name?: string; email?: string; password?: string; inviteCode?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const name = (body.name ?? "").trim();
	const email = (body.email ?? "").trim().toLowerCase();
	const password = body.password ?? "";
	const inviteCode = (body.inviteCode ?? "").trim();

	if (!name || !email || !password || !inviteCode) return json({ error: "missing_fields" }, 400);
	if (password.length < 8) return json({ error: "password_too_short" }, 400);

	const community = await getCommunityByInviteCode(inviteCode);
	if (!community) return json({ error: "invalid_invite_code" }, 400);

	let user;
	try {
		user = await registerUser({ communityId: community.id, name, email, password });
	} catch (e) {
		if (errorMessage(e) === "email_taken") return json({ error: "email_taken" }, 409);
		return json({ error: "registration_failed" }, 500);
	}

	if (!envSecret()) return json({ error: "server_misconfigured" }, 500);
	const now = Math.floor(Date.now() / 1000);
	const exp = now + SESSION_MAX_SECONDS;
	const token = await signSession({ userid: user.userid, communityId: user.communityId, role: user.role, exp }, envSecret());
	const jar = await cookies();
	jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: exp - now });

	return json({ user: publicUser(user) }, 201);
}
