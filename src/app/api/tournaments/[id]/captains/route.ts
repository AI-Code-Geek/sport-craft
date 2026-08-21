import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getPoll } from "@/lib/poll-store";
import { getTeams, setCaptainsAndNames } from "@/lib/team-store";
import { listUsersByCommunity } from "@/lib/user-store";
import { createNotification } from "@/lib/notification-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	const [poll, teams, members] = await Promise.all([getPoll(id), getTeams(id), listUsersByCommunity(session.communityId)]);
	const nameOf = new Map(members.map((u) => [u.userid, u.name]));
	const confirmed = (poll?.entries ?? [])
		.filter((e) => e.status === "confirmed")
		.map((e) => ({ userId: e.userId, name: nameOf.get(e.userId) ?? e.userId }));

	return json({ confirmed, teams, maxTeams: tournament.maxTeams, budgetPoints: tournament.budgetPoints });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { picks?: { name: string; color: number; captainUserId: string }[] };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const picks = body.picks ?? [];
	if (picks.length !== tournament.maxTeams) return json({ error: "wrong_team_count" }, 400);
	if (picks.some((p) => !p.name?.trim() || !p.captainUserId)) return json({ error: "invalid_pick" }, 400);
	const captainIds = new Set(picks.map((p) => p.captainUserId));
	if (captainIds.size !== picks.length) return json({ error: "duplicate_captain" }, 400);

	const wasFirstTime = tournament.status === "draft" || tournament.status === "poll_open" || tournament.status === "poll_closed";
	try {
		const teams = await setCaptainsAndNames(id, picks);
		if (wasFirstTime) {
			await createNotification(id, "captains_selected", `Captains are in: ${tournament.name}`, `${teams.length} teams and their captains are set — the position-based auction is next.`, "confirmed");
		}
		return json({ teams });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
