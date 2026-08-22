/**
 * Live channel — a single public, org-wide chat. KV key `chat:<communityId>` -> ChatMessage[]
 * (append-only, capped, newest last, same small-list-rewritten-whole pattern as notifications). Any
 * active member of the org can read or post — there's no tournament/team scoping.
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { genChatMessageId } from "./ids";
import type { ChatMessage } from "./types";

const key = (communityId: string) => `chat:${communityId}`;
const MAX_KEEP = 200;
const MAX_MESSAGE_LENGTH = 500;

export async function getChatMessages(communityId: string): Promise<ChatMessage[]> {
	return (await kvGetJSON<ChatMessage[]>(key(communityId))) ?? [];
}

export async function postChatMessage(communityId: string, userId: string, name: string, text: string): Promise<ChatMessage> {
	const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
	if (!trimmed) throw new Error("empty_message");

	const list = await getChatMessages(communityId);
	const message: ChatMessage = { id: genChatMessageId(), communityId, userId, name, text: trimmed, createdAt: new Date().toISOString() };
	list.push(message);
	if (list.length > MAX_KEEP) list.splice(0, list.length - MAX_KEEP);
	await kvPutJSON(key(communityId), list);
	return message;
}
