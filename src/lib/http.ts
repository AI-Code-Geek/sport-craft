/** Small JSON response helper shared by every route handler. */
export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : "unknown_error";
}
