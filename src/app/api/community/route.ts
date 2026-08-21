import { readSession } from "@/lib/auth-server";
import { isSuperAdmin, isOrgAdminOf } from "@/lib/authz";
import { getCommunity, updateCommunityName, updateCommunitySport, updateCommunityFeatures, regenerateInviteCode } from "@/lib/community-store";
import type { SportType, Session, FeatureKey } from "@/lib/types";
import { FEATURE_LABELS } from "@/lib/types";
import { json } from "@/lib/http";

const VALID_SPORTS: SportType[] = ["volleyball", "basketball", "soccer", "softball", "pickleball", "other"];
const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

export const dynamic = "force-dynamic";

function canManageOwnOrg(session: Session | null): session is Session & { communityId: string } {
	if (!session || !session.communityId) return false;
	return isSuperAdmin(session) || isOrgAdminOf(session, session.communityId);
}

export async function GET(): Promise<Response> {
	const session = await readSession();
	if (!canManageOwnOrg(session)) return json({ error: "forbidden" }, 403);
	const community = await getCommunity(session.communityId);
	if (!community) return json({ error: "not_found" }, 404);
	return json({ community });
}

export async function PATCH(req: Request): Promise<Response> {
	const session = await readSession();
	if (!canManageOwnOrg(session)) return json({ error: "forbidden" }, 403);
	const communityId = session.communityId;

	let body: { name?: string; sport?: string; features?: Partial<Record<FeatureKey, boolean>>; regenerateInviteCode?: boolean };
	try {
		body = (await req.json()) as typeof body;
	} catch {
		return json({ error: "bad_request" }, 400);
	}

	let community = null;
	const name = body.name?.trim();
	if (name) community = await updateCommunityName(communityId, name);
	if (body.sport && VALID_SPORTS.includes(body.sport as SportType)) community = await updateCommunitySport(communityId, body.sport as SportType);
	if (body.features) {
		const patch = {} as Record<FeatureKey, boolean>;
		for (const k of FEATURE_KEYS) if (body.features[k] !== undefined) patch[k] = !!body.features[k];
		community = await updateCommunityFeatures(communityId, patch);
	}
	if (body.regenerateInviteCode) community = await regenerateInviteCode(communityId);
	if (!community) return json({ error: "not_found" }, 404);
	return json({ community });
}
