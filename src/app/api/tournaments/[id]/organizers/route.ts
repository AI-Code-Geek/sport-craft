import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { getTournament, getOrganizers, addOrganizer, removeOrganizer } from "@/lib/tournament-store";
import { listUsersByCommunity } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	const [organizerIds, members] = await Promise.all([getOrganizers(id), listUsersByCommunity(session.communityId)]);
	const byId = new Map(members.map((u) => [u.userid, u]));
	const organizers = organizerIds.map((oid) => byId.get(oid)).filter((u): u is NonNullable<typeof u> => !!u).map(publicUser);
	return json({ organizers, candidates: members.filter((u) => !organizerIds.includes(u.userid)).map(publicUser) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);

	let body: { action?: "add" | "remove"; userId?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.userId) return json({ error: "missing_user_id" }, 400);

	const organizers = body.action === "remove" ? await removeOrganizer(id, body.userId) : await addOrganizer(id, body.userId);
	return json({ organizerIds: organizers });
}
