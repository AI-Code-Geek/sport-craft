import { readSession } from "@/lib/auth-server";
import { getTournament } from "@/lib/tournament-store";
import { getMatch } from "@/lib/match-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; matchId: string }> },
): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id, matchId } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	const match = await getMatch(id, matchId);
	if (!match) return json({ error: "not_found" }, 404);
	return json({ match });
}
