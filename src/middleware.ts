import { NextResponse, type NextRequest } from "next/server";
import { verifySession, resolveSecret, SESSION_COOKIE } from "@/lib/session";

/**
 * Guard for /app/** (docs/DEVPLAN.md §4). Uses the `middleware` convention (Edge runtime), NOT Next
 * 16's `proxy` convention (Node runtime) — @opennextjs/cloudflare cannot bundle Node middleware into
 * the Worker. This code is edge-safe (Web Crypto only). The session cookie is self-verifying (HMAC),
 * so this does NO KV read per request — only a signature + expiry check. Finer-grained authorization
 * (super_admin / org_admin / captain) happens server-side per-page/route, since it needs a KV read
 * against that specific tournament's Org Admin list.
 */
function csrfBlocked(req: NextRequest): boolean {
	const method = req.method.toUpperCase();
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
	const origin = req.headers.get("origin");
	if (!origin) return false;
	try {
		return new URL(origin).host !== req.headers.get("host");
	} catch {
		return true;
	}
}

export async function middleware(req: NextRequest) {
	if (req.nextUrl.pathname.startsWith("/api/")) {
		if (csrfBlocked(req)) return NextResponse.json({ error: "csrf_origin_mismatch" }, { status: 403 });
		// /api/auth/** must stay reachable while signed out.
		if (req.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
		// Submitting an org-creation request is public — the requester has no account/session yet.
		// GET (Super Admin review) and the [id] approve/reject route still require a session.
		if (req.nextUrl.pathname === "/api/organizations/requests" && req.method === "POST") return NextResponse.next();
		// Local-dev seed helper (start.sh/start.bat) has no session to call it with — gated off in production instead.
		if (req.nextUrl.pathname === "/api/dev/seed-sportcraft-club" && process.env.NODE_ENV !== "production") return NextResponse.next();
		const token = req.cookies.get(SESSION_COOKIE)?.value;
		const session = await verifySession(token, resolveSecret(process.env.SECRET));
		if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		return NextResponse.next();
	}

	const token = req.cookies.get(SESSION_COOKIE)?.value;
	const session = await verifySession(token, resolveSecret(process.env.SECRET));
	if (!session) {
		const url = req.nextUrl.clone();
		url.pathname = "/";
		url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
		return NextResponse.redirect(url);
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/app/:path*", "/api/:path*"],
};
