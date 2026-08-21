import { readSession } from "@/lib/auth-server";
import { getUserById } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { getCommunity } from "@/lib/community-store";
import { getActiveTournament } from "@/lib/tournament-store";
import { getRoleContext } from "@/lib/authz";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export interface MembershipView {
	communityId: string;
	communityName: string;
	role: "org_admin" | "player";
	status: "pending" | "active";
}

export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ user: null }, 200);
	const user = await getUserById(session.userid);
	if (!user) return json({ user: null }, 200);

	const memberships: MembershipView[] = await Promise.all(
		user.memberships.map(async (m) => {
			const community = await getCommunity(m.communityId);
			return { communityId: m.communityId, communityName: community?.name ?? "(deleted org)", role: m.role, status: m.status };
		}),
	);

	const activeCommunity = session.communityId ? await getCommunity(session.communityId) : null;
	const tournament = session.communityId ? await getActiveTournament(session.communityId) : null;
	// Available as soon as there's an active org — doesn't need a tournament to exist yet (see
	// authz.ts's getRoleContext doc comment), otherwise nobody could ever create the first one.
	const roleContext = session.communityId ? await getRoleContext(session, tournament?.id) : null;

	return json({
		user: publicUser(user, session.communityId ?? undefined),
		isSuperAdmin: session.isSuperAdmin,
		communityId: session.communityId,
		features: activeCommunity?.features ?? null,
		memberships,
		tournamentId: tournament?.id ?? null,
		roleContext,
	});
}
