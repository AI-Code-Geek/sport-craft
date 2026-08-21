import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament, putTournament } from "@/lib/tournament-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	return json({ tournament });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: Partial<Record<"name" | "setsToWin" | "pointsPerSet" | "winBy" | "playoffTeamCount", unknown>>;
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	// maxTeams / teamSize / budgetPoints / pollCapacity lock once the poll has opened — they define the
	// confirmed-player capacity everything downstream (teams, positions, auction) is built on.
	if (typeof body.name === "string" && body.name.trim()) tournament.name = body.name.trim();
	if (typeof body.setsToWin === "number") tournament.setsToWin = body.setsToWin;
	if (typeof body.pointsPerSet === "number") tournament.pointsPerSet = body.pointsPerSet;
	if (typeof body.winBy === "number") tournament.winBy = body.winBy;
	if (typeof body.playoffTeamCount === "number") tournament.playoffTeamCount = body.playoffTeamCount;

	await putTournament(tournament);
	return json({ tournament });
}
