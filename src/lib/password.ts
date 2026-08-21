/**
 * Password hashing via Web Crypto (PBKDF2-SHA256), edge-safe — same constraint as session.ts: this
 * must run in both the Edge middleware runtime and the Cloudflare Worker, so no Node `crypto` module.
 */
const encoder = new TextEncoder();
const ITERATIONS = 100_000;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
	return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
	const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
	return crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
		key,
		256,
	);
}

/** Returns { hash, salt } as hex strings, both stored on the user record. */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const bits = await deriveBits(password, salt);
	return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
	if (!hash || !salt) return false;
	const bits = await deriveBits(password, fromHex(salt));
	const candidate = toHex(bits);
	// constant-time compare
	if (candidate.length !== hash.length) return false;
	let diff = 0;
	for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
	return diff === 0;
}
