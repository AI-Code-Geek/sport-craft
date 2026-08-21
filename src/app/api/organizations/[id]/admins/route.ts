import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { getCommunity } from "@/lib/community-store";
import { getUserByEmail, assignOrgAdmin } from "@/lib/user-store";
import { publicUser } from "@/lib/types";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Super Admin only — assigns any existing account (by email) as this org's Org Admin, regardless of
 *  whether the Super Admin is themselves a member of that org. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);
	const { id } = await params;

	const community = await getCommunity(id);
	if (!community) return json({ error: "not_found" }, 404);

	let body: { email?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const email = (body.email ?? "").trim().toLowerCase();
	if (!email) return json({ error: "missing_email" }, 400);

	const target = await getUserByEmail(email);
	if (!target) return json({ error: "user_not_found" }, 404);

	const updated = await assignOrgAdmin(target.userid, id);
	if (!updated) return json({ error: "not_found" }, 404);

	return json({ user: publicUser(updated, id) });
}
