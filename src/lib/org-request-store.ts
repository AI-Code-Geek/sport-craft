/**
 * "Create my organization" requests — public submissions that sit `pending` until a platform Super
 * Admin approves or rejects them. Approval creates the org and makes the requester its founding Org
 * Admin (pre-approved/active membership — Super Admin's approval of the ORG is what's being vetted
 * here, not this one person's membership in it). KV keys: `org-request:<id>`, `idx:org-requests` -> id[].
 */
import { kvGetJSON, kvPutJSON, idxAppend, idxList } from "./kv";
import { genOrgRequestId, slugify, isReservedOrgSlug } from "./ids";
import { hashPassword } from "./password";
import { createCommunity, getCommunityBySlug } from "./community-store";
import { getUserByEmail, createAccountFromHash, addMembership } from "./user-store";
import type { OrganizationRequest, SportType, FeatureKey } from "./types";
import { ALL_FEATURES_ENABLED } from "./types";

const key = (id: string) => `org-request:${id}`;
const INDEX = "idx:org-requests";

export interface SubmitOrgRequestInput {
	orgName: string;
	sport: SportType;
	features?: Record<FeatureKey, boolean>;
	name: string;
	email: string;
	password: string;
}

export async function submitOrgRequest(input: SubmitOrgRequestInput): Promise<OrganizationRequest> {
	if (isReservedOrgSlug(slugify(input.orgName))) throw new Error("org_name_taken");
	const existingOrg = await getCommunityBySlug(slugify(input.orgName));
	if (existingOrg) throw new Error("org_name_taken");

	const { hash, salt } = await hashPassword(input.password);
	const req: OrganizationRequest = {
		id: genOrgRequestId(),
		orgName: input.orgName,
		sport: input.sport,
		features: input.features ?? ALL_FEATURES_ENABLED,
		requesterName: input.name,
		requesterEmail: input.email.trim().toLowerCase(),
		requesterPasswordHash: hash,
		requesterPasswordSalt: salt,
		status: "pending",
		createdAt: new Date().toISOString(),
	};
	await kvPutJSON(key(req.id), req);
	await idxAppend(INDEX, req.id);
	return req;
}

export async function getOrgRequest(id: string): Promise<OrganizationRequest | null> {
	return kvGetJSON<OrganizationRequest>(key(id));
}

/** Never send the requester's password hash/salt over the wire. */
export function publicOrgRequest(r: OrganizationRequest) {
	return {
		id: r.id,
		orgName: r.orgName,
		sport: r.sport,
		features: r.features,
		requesterName: r.requesterName,
		requesterEmail: r.requesterEmail,
		status: r.status,
		communityId: r.communityId ?? null,
		createdAt: r.createdAt,
		decidedAt: r.decidedAt ?? null,
		decidedBy: r.decidedBy ?? null,
	};
}

export async function listOrgRequests(): Promise<OrganizationRequest[]> {
	const ids = await idxList(INDEX);
	const list = await Promise.all(ids.map(getOrgRequest));
	return list.filter((r): r is OrganizationRequest => !!r).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Creates the org, makes the requester its (active, pre-approved) founding Org Admin. */
export async function approveOrgRequest(id: string, decidedBy: string): Promise<OrganizationRequest> {
	const req = await getOrgRequest(id);
	if (!req) throw new Error("not_found");
	if (req.status !== "pending") throw new Error("already_decided");

	const community = await createCommunity(req.orgName, req.sport, req.features);
	let user = await getUserByEmail(req.requesterEmail);
	if (!user) {
		user = await createAccountFromHash({
			name: req.requesterName,
			email: req.requesterEmail,
			passwordHash: req.requesterPasswordHash,
			passwordSalt: req.requesterPasswordSalt,
		});
	}
	await addMembership(user, community.id, "org_admin", "active");

	req.status = "approved";
	req.communityId = community.id;
	req.decidedAt = new Date().toISOString();
	req.decidedBy = decidedBy;
	await kvPutJSON(key(req.id), req);
	return req;
}

export async function rejectOrgRequest(id: string, decidedBy: string): Promise<OrganizationRequest> {
	const req = await getOrgRequest(id);
	if (!req) throw new Error("not_found");
	if (req.status !== "pending") throw new Error("already_decided");
	req.status = "rejected";
	req.decidedAt = new Date().toISOString();
	req.decidedBy = decidedBy;
	await kvPutJSON(key(req.id), req);
	return req;
}
