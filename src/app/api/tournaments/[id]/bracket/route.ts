import { readSession } from "@/lib/auth-server";
import { canManageTournament } from "@/lib/authz";
import { getTournament } from "@/lib/tournament-store";
import { getBracket, generateBracket } from "@/lib/bracket-store";
import { createNotification } from "@/lib/notification-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	const bracket = await getBracket(id);
	return json({ bracket });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	const { id } = await params;
	const tournament = await getTournament(id);
	if (!tournament || tournament.communityId !== session.communityId) return json({ error: "not_found" }, 404);
	if (!(await canManageTournament(id, session))) return json({ error: "forbidden" }, 403);

	let body: { venue?: string; court?: string; dates?: string[] };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const venue = (body.venue ?? "").trim();
	const court = (body.court ?? "").trim();
	const dates = body.dates ?? [];
	if (!venue || !court) return json({ error: "missing_fields" }, 400);

	try {
		const bracket = await generateBracket(id, { venue, court, dates });
		await createNotification(id, "playoffs_set", `Playoff bracket is set: ${tournament.name}`, `The knockout bracket has been generated — see who your team faces.`, "confirmed");
		return json({ bracket });
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
