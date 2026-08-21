import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { addPoint, undoPoint, startNextSet, endMatch } from "@/lib/match-store";
import { advanceBracket } from "@/lib/bracket-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ id: string; matchId: string }> },
): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id, matchId } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { action?: "point" | "undo" | "nextset" | "end"; side?: "a" | "b" };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	try {
		let match;
		if (body.action === "point") {
			if (body.side !== "a" && body.side !== "b") return json({ error: "missing_side" }, 400);
			match = await addPoint(id, matchId, body.side, tournament.pointsPerSet, tournament.winBy);
		} else if (body.action === "undo") {
			if (body.side !== "a" && body.side !== "b") return json({ error: "missing_side" }, 400);
			match = await undoPoint(id, matchId, body.side);
		} else if (body.action === "nextset") {
			match = await startNextSet(id, matchId, tournament.setsToWin);
		} else if (body.action === "end") {
			match = await endMatch(id, matchId);
			if (match.round === "semifinal" || match.round === "final") {
				await advanceBracket(id, { venue: match.venue, court: match.court });
			}
		} else {
			return json({ error: "invalid_action" }, 400);
		}
		return json({ match });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
