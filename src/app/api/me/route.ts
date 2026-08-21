import { readSession } from "@/lib/auth-server";
import { getUserById } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { getActiveTournament } from "@/lib/tournament-store";
import { getRoleContext } from "@/lib/authz";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ user: null }, 200);
	const user = await getUserById(session.userid);
	if (!user) return json({ user: null }, 200);

	const tournament = await getActiveTournament(session.communityId);
	const roleContext = tournament ? await getRoleContext(tournament.id, session) : null;

	return json({
		user: publicUser(user),
		tournamentId: tournament?.id ?? null,
		roleContext,
	});
}
