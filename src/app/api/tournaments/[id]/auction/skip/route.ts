import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { skipNominee, AuctionError } from "@/lib/auction-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	try {
		const auction = await skipNominee(id);
		return json({ auction });
	} catch (e) {
		const status = e instanceof AuctionError ? 400 : 500;
		return json({ error: errorMessage(e) }, status);
	}
}
