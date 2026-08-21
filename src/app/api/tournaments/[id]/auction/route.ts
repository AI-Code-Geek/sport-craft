import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getAuction, startAuction, pauseAuction, teamNeedsCategory } from "@/lib/auction-store";
import { getTeams } from "@/lib/team-store";
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

	const [state, teams, members] = await Promise.all([getAuction(id), getTeams(id), listUsersByCommunity(session.communityId)]);
	const nameOf = new Map(members.map((u) => [u.userid, u.name]));

	const teamViews = teams.map((t) => ({
		id: t.id, name: t.name, color: t.color, budgetTotal: t.budgetTotal, budgetRemaining: t.budgetRemaining,
		filled: t.roster.length - 1,
		needsCurrent: state?.currentNominee ? teamNeedsCategory(t, state.roundOrder[state.currentRoundIndex]) : false,
	}));

	if (!state) return json({ auction: null, teams: teamViews });

	return json({
		auction: {
			...state,
			currentNomineeName: state.currentNominee ? nameOf.get(state.currentNominee) ?? state.currentNominee : null,
			currentCategory: state.roundOrder[state.currentRoundIndex] ?? null,
			roundsCompleted: state.roundOrder.slice(0, state.currentRoundIndex),
			roundsRemaining: state.roundOrder.slice(state.currentRoundIndex + 1),
			nominationQueueNames: state.nominationQueue.map((uid) => nameOf.get(uid) ?? uid),
			log: state.log.slice().reverse().map((l) => ({ ...l, name: nameOf.get(l.userId) ?? l.userId })),
		},
		teams: teamViews,
	});
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { action?: "start" | "pause" };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	try {
		if (body.action === "start") {
			const auction = await startAuction(id);
			await createNotification(id, "auction_started", `Live auction has started: ${tournament.name}`, `Captains are bidding now — follow along live.`, "confirmed");
			return json({ auction });
		}
		if (body.action === "pause") return json({ auction: await pauseAuction(id) });
		return json({ error: "invalid_action" }, 400);
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
