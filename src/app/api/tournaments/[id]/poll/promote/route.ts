import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { promoteEntry } from "@/lib/poll-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { userId?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.userId) return json({ error: "missing_user_id" }, 400);

	try {
		const poll = await promoteEntry(id, body.userId);
		return json({ poll });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
