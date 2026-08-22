import { isProd } from "@/lib/auth-server";
import { ensureSportCraftClubSeed } from "@/lib/seed-sportcraft-club";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Local dev only — creates (or advances) the "SportCraft Club" org: a Super Admin, an Org Admin, 36
 * players, and its tournament progressed up through the requested `stage` (default "users" = no
 * tournament yet). See `Stage` in `@/lib/seed-sportcraft-club` for the full lifecycle order.
 */
export async function POST(req: Request): Promise<Response> {
	if (isProd()) return json({ error: "not_found" }, 404);

	let body: { stage?: string; reset?: boolean } = {};
	try {
		body = (await req.json()) as typeof body;
	} catch {
		// no body / not JSON — fall back to the default stage
	}

	try {
		const result = await ensureSportCraftClubSeed(body.stage ?? "users", body.reset === true);
		return json(result);
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
