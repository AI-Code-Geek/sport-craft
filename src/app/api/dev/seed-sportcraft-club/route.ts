import { isProd } from "@/lib/auth-server";
import { ensureSportCraftClubSeed } from "@/lib/seed-sportcraft-club";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Local dev only — creates the "SportCraft Club" org + a Super Admin, an Org Admin, and 36 players. */
export async function POST(): Promise<Response> {
	if (isProd()) return json({ error: "not_found" }, 404);
	const result = await ensureSportCraftClubSeed();
	return json(result);
}
