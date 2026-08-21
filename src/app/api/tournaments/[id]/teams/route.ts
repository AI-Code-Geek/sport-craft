import { readSession } from "@/lib/auth-server";
import { getTournament } from "@/lib/tournament-store";
import { getTeams } from "@/lib/team-store";
import { listUsersByCommunity } from "@/lib/user-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	const [teams, members] = await Promise.all([getTeams(id), listUsersByCommunity(session.communityId)]);
	const nameOf = new Map(members.map((u) => [u.userid, u.name]));
	const withNames = teams.map((t) => ({
		...t,
		captainName: nameOf.get(t.captainUserId) ?? t.captainUserId,
		roster: t.roster.map((r) => ({ ...r, name: nameOf.get(r.userId) ?? r.userId })),
	}));
	return json({ teams: withNames });
}
