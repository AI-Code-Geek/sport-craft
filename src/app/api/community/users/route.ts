import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { listUsersByCommunity, setUserRole, setUserSuspended } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);
	const users = await listUsersByCommunity(session.communityId);
	return json({ users: users.map(publicUser) });
}

export async function PATCH(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);

	let body: { userId?: string; role?: "super_admin" | "player"; suspended?: boolean };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.userId) return json({ error: "missing_user_id" }, 400);

	let user = null;
	if (body.role) user = await setUserRole(body.userId, body.role);
	if (typeof body.suspended === "boolean") user = await setUserSuspended(body.userId, body.suspended);
	if (!user) return json({ error: "not_found" }, 404);
	return json({ user: publicUser(user) });
}
