import { readSession } from "@/lib/auth-server";
import { listUsersByCommunity, membershipFor } from "@/lib/user-store";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Any active member (not just admins) can see who runs their org — used by the org home page's
 *  "Organizers" card. Names only, no email/contact details. */
export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session || !session.communityId) return json({ error: "unauthorized" }, 401);
	const communityId = session.communityId;

	const members = await listUsersByCommunity(communityId);
	const organizers = members
		.filter((u) => {
			const m = membershipFor(u, communityId);
			return m?.status === "active" && m.role === "org_admin";
		})
		.map((u) => ({ userid: u.userid, name: u.name }));

	return json({ organizers });
}
