import { readSession } from "@/lib/auth-server";
import { isSuperAdmin } from "@/lib/authz";
import { submitOrgRequest, listOrgRequests, publicOrgRequest } from "@/lib/org-request-store";
import type { SportType, FeatureKey } from "@/lib/types";
import { FEATURE_LABELS, ALL_FEATURES_ENABLED } from "@/lib/types";
import { json, errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";

const VALID_SPORTS: SportType[] = ["volleyball", "basketball", "soccer", "softball", "pickleball", "other"];
const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

function normalizeFeatures(input: unknown): Record<FeatureKey, boolean> {
	if (!input || typeof input !== "object") return ALL_FEATURES_ENABLED;
	const raw = input as Record<string, unknown>;
	const out = {} as Record<FeatureKey, boolean>;
	for (const k of FEATURE_KEYS) out[k] = raw[k] === undefined ? true : !!raw[k];
	return out;
}

/** Public — anyone can request a new organization. It sits `pending` until a Super Admin decides. */
export async function POST(req: Request): Promise<Response> {
	let body: { orgName?: string; sport?: string; features?: unknown; name?: string; email?: string; password?: string };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}
	const orgName = (body.orgName ?? "").trim();
	const name = (body.name ?? "").trim();
	const email = (body.email ?? "").trim().toLowerCase();
	const password = body.password ?? "";
	const sport: SportType = VALID_SPORTS.includes(body.sport as SportType) ? (body.sport as SportType) : "volleyball";
	const features = normalizeFeatures(body.features);

	if (!orgName || !name || !email || !password) return json({ error: "missing_fields" }, 400);
	if (password.length < 8) return json({ error: "password_too_short" }, 400);

	try {
		const request = await submitOrgRequest({ orgName, sport, features, name, email, password });
		return json({ request: { id: request.id, orgName: request.orgName, status: request.status } }, 201);
	} catch (e) {
		if (errorMessage(e) === "org_name_taken") return json({ error: "org_name_taken" }, 409);
		return json({ error: "request_failed" }, 500);
	}
}

/** Super Admin only — every request, newest first. */
export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!isSuperAdmin(session)) return json({ error: "forbidden" }, 403);
	const requests = await listOrgRequests();
	return json({ requests: requests.map(publicOrgRequest) });
}
