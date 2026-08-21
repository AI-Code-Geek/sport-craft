/** Server-side auth helpers for route handlers / server components. Server-only. */
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveSecret, verifySession, SESSION_COOKIE } from "./session";
import type { Session } from "./types";

/** Signing secret from the bound env (falls back to process.env for local dev). */
export function envSecret(): string {
	let s: string | undefined;
	try {
		s = getCloudflareContext().env.SECRET;
	} catch {
		// no Cloudflare context (e.g. some build phases) — resolveSecret handles the fallback
	}
	return resolveSecret(s);
}

/** Verify the session cookie on the incoming request. `null` if missing/invalid/expired. */
export async function readSession(): Promise<Session | null> {
	const jar = await cookies();
	return verifySession(jar.get(SESSION_COOKIE)?.value, envSecret());
}

export const isProd = () => process.env.NODE_ENV === "production";
