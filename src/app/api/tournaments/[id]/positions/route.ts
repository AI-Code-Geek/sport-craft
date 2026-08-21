import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getPositions, initPositions, assignPosition, bucketCounts, allBucketsFull, finalizePositions, remainingPlayerPool } from "@/lib/position-store";
import { listUsersByCommunity } from "@/lib/user-store";
import { createNotification } from "@/lib/notification-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	let state = await getPositions(id);
	const pool = await remainingPlayerPool(id);
	if (!state && pool.length > 0 && (await canManageTournament(id, session))) {
		state = await initPositions(id);
	}
	if (!state) return json({ positions: null, players: [] });

	const members = await listUsersByCommunity(session.communityId);
	const nameOf = new Map(members.map((u) => [u.userid, u.name]));
	const players = pool.map((userId) => ({ userId, name: nameOf.get(userId) ?? userId, category: state!.assignment[userId] ?? null }));

	return json({
		positions: state,
		players,
		counts: bucketCounts(state),
		target: tournament.maxTeams,
		allFull: await allBucketsFull(id),
	});
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { userId?: string; category?: string; finalize?: boolean };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	try {
		if (body.finalize) {
			if (!(await allBucketsFull(id))) return json({ error: "buckets_incomplete" }, 400);
			await finalizePositions(id);
			await createNotification(id, "positions_set", `Rosters categorized: ${tournament.name}`, `Every player is sorted by position — the live auction is about to begin.`, "confirmed");
			return json({ ok: true });
		}
		if (!body.userId || !body.category) return json({ error: "missing_fields" }, 400);
		const state = await assignPosition(id, body.userId, body.category);
		return json({ positions: state, counts: bucketCounts(state) });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
