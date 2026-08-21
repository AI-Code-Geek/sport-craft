/**
 * In-app notifications — KV key `notifications:<tournamentId>` -> AppNotification[] (append-only,
 * capped, newest last). Role-based audience: an admin action (poll opened, captains picked, auction
 * started, ...) writes one notification tagged with who it's relevant to; each viewer's feed is
 * filtered server-side by their actual relationship to the tournament (never trust a client-supplied
 * role). "Seen" is tracked per user per tournament on the user record (`notificationsSeenAt`), the
 * same pattern the reference app uses for `seenReports`.
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { genNotificationId } from "./ids";
import { getPoll } from "./poll-store";
import type { AppNotification, NotificationAudience, NotificationType } from "./types";

const key = (tournamentId: string) => `notifications:${tournamentId}`;
const MAX_KEEP = 100;

export async function createNotification(
	tournamentId: string,
	type: NotificationType,
	title: string,
	message: string,
	audience: NotificationAudience,
): Promise<AppNotification> {
	const list = (await kvGetJSON<AppNotification[]>(key(tournamentId))) ?? [];
	const n: AppNotification = { id: genNotificationId(), tournamentId, type, title, message, audience, createdAt: new Date().toISOString() };
	list.push(n);
	if (list.length > MAX_KEEP) list.splice(0, list.length - MAX_KEEP);
	await kvPutJSON(key(tournamentId), list);
	return n;
}

export async function getNotifications(tournamentId: string): Promise<AppNotification[]> {
	return (await kvGetJSON<AppNotification[]>(key(tournamentId))) ?? [];
}

export interface ViewerContext {
	isSuperAdmin: boolean;
	isOrganizer: boolean;
	captainTeamId: string | null;
}

/** Notifications this specific user should see, newest first, filtered by their real relationship to the tournament. */
export async function getNotificationsForUser(tournamentId: string, userId: string, ctx: ViewerContext): Promise<AppNotification[]> {
	const all = await getNotifications(tournamentId);
	const managesTournament = ctx.isSuperAdmin || ctx.isOrganizer;
	if (managesTournament) return all.slice().reverse(); // organizers/admin see every notification

	const isCaptain = !!ctx.captainTeamId;
	let isConfirmed = isCaptain;
	if (!isConfirmed) {
		const poll = await getPoll(tournamentId);
		isConfirmed = !!poll?.entries.find((e) => e.userId === userId && e.status === "confirmed");
	}

	return all
		.filter((n) => {
			if (n.audience === "all") return true;
			if (n.audience === "confirmed") return isConfirmed;
			if (n.audience === "captains") return isCaptain;
			return false; // "organizers" — already handled above
		})
		.slice()
		.reverse();
}
