import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { joinPoll, withdrawFromPoll } from "@/lib/poll-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Self-service join/withdraw. An organizer/super admin may act on another userId (admin removal). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	let body: { action?: "join" | "withdraw"; userId?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	let targetUserId = session.userid;
	if (body.userId && body.userId !== session.userid) {
		if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);
		targetUserId = body.userId;
	}

	try {
		if (body.action === "join") {
			const result = await joinPoll(id, targetUserId);
			return json({ status: result.status });
		}
		if (body.action === "withdraw") {
			await withdrawFromPoll(id, targetUserId);
			return json({ ok: true });
		}
		return json({ error: "invalid_action" }, 400);
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
