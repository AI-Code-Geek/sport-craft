/** Community CRUD — KV keys: `community:<id>`, `idx:community-slug:<slug>` -> id, `idx:communities` -> id[]. */
import { kvGetJSON, kvPutJSON, idxAppend, idxList } from "./kv";
import { genCommunityId, genInviteCode, slugify } from "./ids";
import type { Community, SportType, FeatureKey } from "./types";
import { ALL_FEATURES_ENABLED } from "./types";

const key = (id: string) => `community:${id}`;
const slugKey = (slug: string) => `idx:community-slug:${slug}`;
const COMMUNITIES_INDEX = "idx:communities";

export async function createCommunity(name: string, sport: SportType = "volleyball", features: Record<FeatureKey, boolean> = ALL_FEATURES_ENABLED): Promise<Community> {
	const slug = slugify(name) || genCommunityId();
	const existing = await getCommunityBySlug(slug);
	if (existing) return existing;
	const community: Community = {
		id: genCommunityId(),
		name,
		slug,
		sport,
		features,
		inviteCode: genInviteCode(name),
		createdAt: new Date().toISOString(),
	};
	await kvPutJSON(key(community.id), community);
	await kvPutJSON(slugKey(slug), community.id);
	await idxAppend(COMMUNITIES_INDEX, community.id);
	return community;
}

export async function getCommunity(id: string): Promise<Community | null> {
	return kvGetJSON<Community>(key(id));
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
	const id = await kvGetJSON<string>(slugKey(slug));
	if (!id) return null;
	return getCommunity(id);
}

export async function getCommunityByInviteCode(code: string): Promise<Community | null> {
	const norm = code.trim().toUpperCase();
	const ids = await idxList(COMMUNITIES_INDEX);
	for (const id of ids) {
		const c = await getCommunity(id);
		if (c && c.inviteCode.toUpperCase() === norm) return c;
	}
	return null;
}

export async function listCommunities(): Promise<Community[]> {
	const ids = await idxList(COMMUNITIES_INDEX);
	const list = await Promise.all(ids.map(getCommunity));
	return list.filter((c): c is Community => !!c);
}

export async function updateCommunityName(id: string, name: string): Promise<Community | null> {
	const community = await getCommunity(id);
	if (!community) return null;
	community.name = name;
	await kvPutJSON(key(community.id), community);
	return community;
}

export async function updateCommunitySport(id: string, sport: SportType): Promise<Community | null> {
	const community = await getCommunity(id);
	if (!community) return null;
	community.sport = sport;
	await kvPutJSON(key(community.id), community);
	return community;
}

export async function updateCommunityFeatures(id: string, features: Partial<Record<FeatureKey, boolean>>): Promise<Community | null> {
	const community = await getCommunity(id);
	if (!community) return null;
	community.features = { ...community.features, ...features };
	await kvPutJSON(key(community.id), community);
	return community;
}

/** Invalidates the old invite/org code — anyone who hasn't registered yet needs the new one. */
export async function regenerateInviteCode(id: string): Promise<Community | null> {
	const community = await getCommunity(id);
	if (!community) return null;
	community.inviteCode = genInviteCode(community.name);
	await kvPutJSON(key(community.id), community);
	return community;
}
