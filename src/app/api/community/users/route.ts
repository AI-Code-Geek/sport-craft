import { readSession } from "@/lib/auth-server";
import { isSuperAdmin, isOrgAdminOf } from "@/lib/authz";
import {
	listUsersByCommunity, membershipFor, setMembershipRole, setMembershipSuspended, approveMembership, rejectMembership,
} from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import type { Session } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

function canManageOwnOrg(session: Session | null): session is Session & { communityId: string } {
	if (!session || !session.communityId) return false;
	return isSuperAdmin(session) || isOrgAdminOf(session, session.communityId);
}

/** Active members + the pending join-request queue for the caller's own org. */
export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!canManageOwnOrg(session)) return json({ error: "forbidden" }, 403);
	const all = await listUsersByCommunity(session.communityId);
	const members = all
		.filter((u) => membershipFor(u, session.communityId)?.status === "active")
		.map((u) => publicUser(u, session.communityId));
	const pending = all
		.filter((u) => membershipFor(u, session.communityId)?.status === "pending")
		.map((u) => publicUser(u, session.communityId));
	return json({ members, pending });
}

export async function PATCH(req: Request): Promise<Response> {
	const session = await readSession();
	if (!canManageOwnOrg(session)) return json({ error: "forbidden" }, 403);

	let body: { userId?: string; role?: "org_admin" | "player"; suspended?: boolean; decision?: "approve" | "reject" };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.userId) return json({ error: "missing_user_id" }, 400);

	let user = null;
	if (body.decision === "approve") user = await approveMembership(body.userId, session.communityId);
	else if (body.decision === "reject") user = await rejectMembership(body.userId, session.communityId);
	else {
		if (body.role) user = await setMembershipRole(body.userId, session.communityId, body.role);
		if (typeof body.suspended === "boolean") user = await setMembershipSuspended(body.userId, session.communityId, body.suspended);
	}
	if (!user) return json({ error: "not_found" }, 404);
	return json({ user: publicUser(user, session.communityId) });
}
