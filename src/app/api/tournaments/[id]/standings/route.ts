import { readSession } from "@/lib/auth-server";
import { getTournament } from "@/lib/tournament-store";
import { getTeams } from "@/lib/team-store";
import { getMatches } from "@/lib/match-store";
import { computeStandings } from "@/lib/standings";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	const [teams, matches] = await Promise.all([getTeams(id), getMatches(id)]);
	const standings = computeStandings(teams, matches, tournament.winPoints);
	return json({ standings, playoffTeamCount: tournament.playoffTeamCount });
}
