import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { approveOrgRequest, rejectOrgRequest, publicOrgRequest } from "@/lib/org-request-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);
	const { id } = await params;

	let body: { action?: "approve" | "reject" };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (body.action !== "approve" && body.action !== "reject") return json({ error: "invalid_action" }, 400);

	try {
		const r =
			body.action === "approve" ? await approveOrgRequest(id, session.userid) : await rejectOrgRequest(id, session.userid);
		return json({ request: publicOrgRequest(r) });
	} catch (e) {
		const msg = errorMessage(e);
		if (msg === "not_found") return json({ error: "not_found" }, 404);
		if (msg === "already_decided") return json({ error: "already_decided" }, 409);
		return json({ error: "action_failed" }, 500);
	}
}
