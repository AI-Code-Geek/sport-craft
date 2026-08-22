import { readSession } from "@/lib/auth-server";
import { getChatMessages, postChatMessage } from "@/lib/chat-store";
import { getUserById } from "@/lib/user-store";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Any active member of the org can read or post — a single public, org-wide channel. */
export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session || !session.communityId) return json({ error: "unauthorized" }, 401);
	const messages = await getChatMessages(session.communityId);
	return json({ messages });
}

export async function POST(req: Request): Promise<Response> {
	const session = await readSession();
	if (!session || !session.communityId) return json({ error: "unauthorized" }, 401);

	let body: { text?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	if (!body.text || !body.text.trim()) return json({ error: "empty_message" }, 400);

	const user = await getUserById(session.userid);
	if (!user) return json({ error: "not_found" }, 404);

	try {
		const message = await postChatMessage(session.communityId, user.userid, user.name, body.text);
		return json({ message }, 201);
	} catch (e) {
		return json({ error: errorMessage(e) }, 400);
	}
}
