import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getMatch, rescheduleMatch } from "@/lib/match-store";
import { json, errorMessage } from "@/lib/http";

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

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ id: string; matchId: string }> },
): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id, matchId } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { scheduledAt?: string; venue?: string; court?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	try {
		const match = await rescheduleMatch(id, matchId, body);
		return json({ match });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
