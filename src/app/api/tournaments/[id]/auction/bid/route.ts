import { readSession } from "@/lib/auth-server";
import { getTournament } from "@/lib/tournament-store";
import { isCaptain } from "@/lib/team-store";
import { placeBid, AuctionError } from "@/lib/auction-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Only the captain of the bidding team may place a bid — teamId is derived server-side, never trusted from the client. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	const team = await isCaptain(id, session.userid);
	if (!team) return json({ error: "not_a_captain" }, 403);

	let body: { amount?: number };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const amount = Number(body.amount);
	if (!Number.isFinite(amount) || amount < 1) return json({ error: "invalid_amount" }, 400);

	try {
		const auction = await placeBid(id, team.id, Math.floor(amount));
		return json({ auction });
	} catch (e) {
		const status = e instanceof AuctionError ? 400 : 500;
		return json({ error: errorMessage(e) }, status);
	}
}
