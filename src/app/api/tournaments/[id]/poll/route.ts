import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getPoll, openPoll, freezePoll, closePoll } from "@/lib/poll-store";
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

	const [poll, members] = await Promise.all([getPoll(id), listUsersByCommunity(session.communityId)]);
	const nameOf = new Map(members.map((u) => [u.userid, u.name]));
	const entries = (poll?.entries ?? [])
		.slice()
		.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
		.map((e) => ({ ...e, name: nameOf.get(e.userId) ?? e.userId }));

	return json({ poll: poll ? { ...poll, entries } : null, capacity: tournament.pollCapacity });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { action?: "open" | "close" | "freeze" };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	try {
		if (body.action === "open") {
			const poll = await openPoll(id);
			await createNotification(id, "poll_opened", `Poll is open: ${tournament.name}`, `Join now — first ${tournament.pollCapacity} confirmed, everyone else waitlists.`, "all");
			return json({ poll });
		}
		if (body.action === "freeze") return json({ poll: await freezePoll(id) });
		if (body.action === "close") {
			const poll = await closePoll(id);
			await createNotification(id, "poll_closed", `Poll closed: ${tournament.name}`, `Signup is closed — captains are being picked next.`, "confirmed");
			return json({ poll });
		}
		return json({ error: "invalid_action" }, 400);
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
