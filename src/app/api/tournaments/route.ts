import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { createTournament, listTournamentsByCommunity } from "@/lib/tournament-store";
import { createNotification } from "@/lib/notification-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const tournaments = await listTournamentsByCommunity(session.communityId);
	return json({ tournaments });
}

export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);

	let body: {
		name?: string; maxTeams?: number; teamSize?: number; budgetPoints?: number;
		setsToWin?: number; pointsPerSet?: number; winBy?: number; playoffTeamCount?: number;
	};
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const name = (body.name ?? "").trim();
	if (!name) return json({ error: "missing_name" }, 400);
	const maxTeams = Number(body.maxTeams) || 6;
	const teamSize = Number(body.teamSize) || 6;
	const budgetPoints = Number(body.budgetPoints) || 100;
	const setsToWin = Number(body.setsToWin) || 2;
	const pointsPerSet = Number(body.pointsPerSet) || 25;
	const winBy = Number(body.winBy) || 2;
	const playoffTeamCount = Number(body.playoffTeamCount) || 4;

	if (maxTeams < 2 || teamSize < 2) return json({ error: "invalid_team_config" }, 400);

	const tournament = await createTournament({
		communityId: session.communityId, name, maxTeams, teamSize, budgetPoints,
		setsToWin, pointsPerSet, winBy, playoffTeamCount, createdBy: session.userid,
	});
	await createNotification(tournament.id, "tournament_created", `New tournament: ${tournament.name}`, `A new tournament has been created for your community. Watch for the poll to open.`, "all");
	return json({ tournament }, 201);
}
