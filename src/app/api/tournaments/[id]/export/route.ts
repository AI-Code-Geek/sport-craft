import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getPoll } from "@/lib/poll-store";
import { getTeams } from "@/lib/team-store";
import { getPositions } from "@/lib/position-store";
import { getAuction } from "@/lib/auction-store";
import { getMatches } from "@/lib/match-store";
import { getBracket } from "@/lib/bracket-store";
import { computeStandings } from "@/lib/standings";
import { getNotifications } from "@/lib/notification-store";
import { listUsersByCommunity } from "@/lib/user-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Full tournament state as one JSON document — poll, rosters, positions, auction log, schedule/match
 * results, standings (computed fresh, same as the live UI), bracket, and notifications. Org Admin /
 * Super Admin only. Player names are resolved (not just userids) so this is readable as a report on
 * its own, not just a raw data dump.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	const [poll, teams, positions, auction, matches, bracket, notifications, members] = await Promise.all([
		getPoll(id),
		getTeams(id),
		getPositions(id),
		getAuction(id),
		getMatches(id),
		getBracket(id),
		getNotifications(id),
		listUsersByCommunity(session.communityId),
	]);
	const nameOf = new Map(members.map((u) => [u.userid, u.name]));
	const withName = (userId: string) => ({ userId, name: nameOf.get(userId) ?? userId });

	const standings = computeStandings(teams, matches).map((row) => ({
		...row,
		teamName: teams.find((t) => t.id === row.teamId)?.name ?? row.teamId,
	}));

	const exported = {
		exportedAt: new Date().toISOString(),
		tournament,
		poll: poll
			? { ...poll, entries: poll.entries.map((e) => ({ ...e, ...withName(e.userId) })) }
			: null,
		teams: teams.map((t) => ({
			...t,
			captainName: nameOf.get(t.captainUserId) ?? t.captainUserId,
			roster: t.roster.map((r) => ({ ...r, ...withName(r.userId) })),
		})),
		positions,
		auction: auction
			? { ...auction, log: auction.log.map((l) => ({ ...l, ...withName(l.userId) })) }
			: null,
		matches,
		standings,
		bracket,
		notifications,
	};

	return json(exported);
}
