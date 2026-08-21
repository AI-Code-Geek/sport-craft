import { readSession } from "@/lib/auth-server";
import { getTournament } from "@/lib/tournament-store";
import { getRoleContext } from "@/lib/authz";
import { getNotificationsForUser } from "@/lib/notification-store";
import { getUserById, markNotificationsSeen } from "@/lib/user-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	const [roleContext, user] = await Promise.all([getRoleContext(session, id), getUserById(session.userid)]);
	const list = await getNotificationsForUser(id, session.userid, roleContext);
	const seenAt = user?.notificationsSeenAt?.[id];
	const notifications = list.map((n) => ({ ...n, unread: !seenAt || n.createdAt > seenAt }));
	const unreadCount = notifications.filter((n) => n.unread).length;

	return json({ notifications, unreadCount });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	await markNotificationsSeen(session.userid, id);
	return json({ ok: true });
}
