/**
 * Generic Cloudflare KV access, server-only. No D1/database (docs/DEVPLAN.md §3) — every domain store
 * (community, user, tournament, poll, teams, positions, auction, matches) reads/writes through here.
 *
 * Local `next dev` without a real KV binding falls back to an in-process Map so the app is usable
 * without wrangler/miniflare set up. That fallback is per-server-instance (lost on restart) — fine for
 * local development, never used in production (Cloudflare always binds KV there).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

function realKV(): KVNamespace | undefined {
	try {
		return getCloudflareContext().env.KV;
	} catch {
		return undefined;
	}
}

const memory = new Map<string, string>();

/** Minimal subset of the KVNamespace surface this app uses, backed by `memory` when no binding exists. */
const memoryKV = {
	async get<T>(key: string, type?: "json"): Promise<T | string | null> {
		const v = memory.get(key);
		if (v == null) return null;
		return type === "json" ? (JSON.parse(v) as T) : v;
	},
	async put(key: string, value: string): Promise<void> {
		memory.set(key, value);
	},
	async delete(key: string): Promise<void> {
		memory.delete(key);
	},
	async list({ prefix }: { prefix: string }): Promise<{ keys: { name: string }[] }> {
		const keys = [...memory.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
		return { keys };
	},
};

function store() {
	return realKV() ?? memoryKV;
}

/** Read a JSON value, or `null` if absent/unparseable. */
export async function kvGetJSON<T>(key: string): Promise<T | null> {
	try {
		const v = await store().get<T>(key, "json");
		return (v as T) ?? null;
	} catch {
		return null;
	}
}

/** Write a JSON value. */
export async function kvPutJSON<T>(key: string, value: T): Promise<void> {
	await store().put(key, JSON.stringify(value));
}

export async function kvDelete(key: string): Promise<void> {
	await store().delete(key);
}

/** Read a plain string value, or `null`. */
export async function kvGetString(key: string): Promise<string | null> {
	const v = await store().get(key);
	return (v as string | null) ?? null;
}

export async function kvPutString(key: string, value: string): Promise<void> {
	await store().put(key, value);
}

/** List every key name under a prefix (bounded — this app's lists are always small: users, tournaments). */
export async function kvListKeys(prefix: string): Promise<string[]> {
	const { keys } = await store().list({ prefix });
	return keys.map((k: { name: string }) => k.name);
}

// ── Small index-list helpers (idx:<thing> -> string[] of ids) ────────────────
// Mirrors the reference app's `idx:users` / `idx:reqs` pattern: cheap to read/write at this scale
// (a community's tournament count, a tournament's match count — all small, single-digit-to-low-hundreds).

export async function idxAppend(indexKey: string, id: string): Promise<void> {
	const ids = (await kvGetJSON<string[]>(indexKey)) ?? [];
	if (!ids.includes(id)) {
		ids.push(id);
		await kvPutJSON(indexKey, ids);
	}
}

export async function idxRemove(indexKey: string, id: string): Promise<void> {
	const ids = (await kvGetJSON<string[]>(indexKey)) ?? [];
	const next = ids.filter((x) => x !== id);
	await kvPutJSON(indexKey, next);
}

export async function idxList(indexKey: string): Promise<string[]> {
	return (await kvGetJSON<string[]>(indexKey)) ?? [];
}
