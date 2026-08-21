import { cookies } from "next/headers";
import { ensureDemoSeed } from "@/lib/seed";
import { verifyLogin, putUser, resolveActiveMembership } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { signSession, SESSION_COOKIE, SESSION_MAX_SECONDS } from "@/lib/session";
import { envSecret, isProd } from "@/lib/auth-server";
import { clientIp, isRateLimited, recordAttempt, clearAttempts } from "@/lib/rate-limit";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_FAILED = 10;
const WINDOW_SEC = 600;

export async function POST(req: Request): Promise<Response> {
	await ensureDemoSeed();

	const ip = clientIp(req);
	if (await isRateLimited("login", ip, MAX_FAILED)) return json({ error: "too_many_attempts" }, 429);

	let body: { email?: string; password?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const email = (body.email ?? "").trim().toLowerCase();
	const password = body.password ?? "";
	if (!email || !password) return json({ error: "missing_fields" }, 400);

	const user = await verifyLogin(email, password);
	if (!user) {
		await recordAttempt("login", ip, WINDOW_SEC);
		return json({ error: "invalid_credentials" }, 401);
	}

	if (!envSecret()) return json({ error: "server_misconfigured" }, 500);
	const now = Math.floor(Date.now() / 1000);
	const exp = now + SESSION_MAX_SECONDS;
	const active = resolveActiveMembership(user);
	const token = await signSession(
		{ userid: user.userid, isSuperAdmin: user.isSuperAdmin, communityId: active?.communityId ?? null, role: active?.role ?? null, exp },
		envSecret(),
	);
	const jar = await cookies();
	jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd(), sameSite: "lax", path: "/", maxAge: exp - now });

	await clearAttempts("login", ip);
	user.lastLoginAt = new Date().toISOString();
	await putUser(user);

	return json({ user: publicUser(user, active?.communityId) }, 200);
}
