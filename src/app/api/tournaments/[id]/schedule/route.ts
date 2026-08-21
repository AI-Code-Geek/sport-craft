import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getMatches, generateRoundRobinSchedule } from "@/lib/match-store";
import { createNotification } from "@/lib/notification-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	const matches = await getMatches(id);
	return json({ matches: matches.slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { venue?: string; courts?: string[]; times?: string[]; startDate?: string; daysBetween?: number };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const venue = (body.venue ?? "").trim();
	const courts = (body.courts ?? []).map((c) => c.trim()).filter(Boolean);
	const times = (body.times ?? []).map((t) => t.trim()).filter(Boolean);
	const startDate = body.startDate ?? "";
	const daysBetween = Number(body.daysBetween) || 7;
	if (!venue || courts.length === 0 || times.length === 0 || !startDate) return json({ error: "missing_fields" }, 400);

	try {
		const matches = await generateRoundRobinSchedule(id, { venue, courts, times, startDate, daysBetween });
		await createNotification(id, "schedule_published", `Schedule is live: ${tournament.name}`, `The match schedule has been published — check when your team plays.`, "confirmed");
		return json({ matches });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
