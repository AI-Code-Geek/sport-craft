/** Short random ids, Web Crypto only (edge-safe). */
function randomHex(bytes: number): string {
	const b = new Uint8Array(bytes);
	crypto.getRandomValues(b);
	return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const genUserId = () => "u_" + randomHex(4);
export const genCommunityId = () => "c_" + randomHex(3);
export const genTournamentId = () => "t_" + randomHex(4);
export const genTeamId = () => "team_" + randomHex(3);
export const genMatchId = () => "m_" + randomHex(4);
export const genNotificationId = () => "n_" + randomHex(4);
export const genOrgRequestId = () => "orgreq_" + randomHex(4);
export const genChatMessageId = () => "chat_" + randomHex(4);

export function slugify(s: string): string {
	return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Slugs that can't be used for an org — they'd collide with a static route under /app/<slug>/. */
const RESERVED_ORG_SLUGS = new Set(["admin"]);
export function isReservedOrgSlug(slug: string): boolean {
	return RESERVED_ORG_SLUGS.has(slug);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
export function genInviteCode(name: string): string {
	const prefix = slugify(name).slice(0, 8).toUpperCase() || "COMM";
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	let suffix = "";
	for (const b of bytes) suffix += CODE_ALPHABET[b % CODE_ALPHABET.length];
	return `${prefix}-${suffix}`;
}
