/**
 * User CRUD — KV keys: `user:<userid>`, `idx:email:<email>` -> userid, `idx:community-users:<communityId>` -> userid[].
 * One account (identified by email) may hold a `Membership` in multiple orgs, each with its own role.
 * Self-registration always yields a "player" membership with status "pending" — that org's Org Admin
 * must approve it before it grants any access (docs/DEVPLAN.md §4). "org_admin" is only ever granted
 * pre-approved: either as the founding admin of an approved org-creation request, or by an existing
 * Org Admin/Super Admin promoting an already-active member.
 */
import { kvGetJSON, kvPutJSON, idxAppend, idxRemove, idxList } from "./kv";
import { genUserId } from "./ids";
import { hashPassword, verifyPassword } from "./password";
import type { UserRecord, Membership, CommunityRole, MembershipStatus } from "./types";

const key = (userid: string) => `user:${userid}`;
const emailKey = (email: string) => `idx:email:${email.trim().toLowerCase()}`;
const communityUsersIndex = (communityId: string) => `idx:community-users:${communityId}`;

export async function getUserById(userid: string): Promise<UserRecord | null> {
	return kvGetJSON<UserRecord>(key(userid));
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
	const id = await kvGetJSON<string>(emailKey(email));
	if (!id) return null;
	return getUserById(id);
}

/** Everyone who currently has ANY membership row (pending or active) in this community. */
export async function listUsersByCommunity(communityId: string): Promise<UserRecord[]> {
	const ids = await idxList(communityUsersIndex(communityId));
	const users = await Promise.all(ids.map(getUserById));
	return users.filter((u): u is UserRecord => !!u).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listMembershipsByStatus(communityId: string, status: MembershipStatus): Promise<UserRecord[]> {
	const all = await listUsersByCommunity(communityId);
	return all.filter((u) => membershipFor(u, communityId)?.status === status);
}

export function membershipFor(user: UserRecord, communityId: string): Membership | undefined {
	return user.memberships.find((m) => m.communityId === communityId);
}

/** The membership a session/login should resume into: `lastActiveCommunityId` if still active, else the first active one, else null. */
export function resolveActiveMembership(user: UserRecord): Membership | null {
	if (user.lastActiveCommunityId) {
		const m = membershipFor(user, user.lastActiveCommunityId);
		if (m && m.status === "active") return m;
	}
	return user.memberships.find((m) => m.status === "active") ?? null;
}

export interface CreateAccountInput {
	name: string;
	email: string;
	password: string;
	/** Set true only when seeding a platform Super Admin — never reachable from a client request. */
	isSuperAdmin?: boolean;
}

/** Creates a brand-new account with NO memberships yet. Throws `email_taken` if the email is already registered. */
export async function createAccount(input: CreateAccountInput): Promise<UserRecord> {
	const existing = await getUserByEmail(input.email);
	if (existing) throw new Error("email_taken");
	const { hash, salt } = await hashPassword(input.password);
	return createAccountFromHash({ name: input.name, email: input.email, passwordHash: hash, passwordSalt: salt, isSuperAdmin: input.isSuperAdmin });
}

export interface CreateAccountFromHashInput {
	name: string;
	email: string;
	passwordHash: string;
	passwordSalt: string;
	isSuperAdmin?: boolean;
}

/** Same as `createAccount`, but for a password already hashed earlier (e.g. an org request submitted before approval). */
export async function createAccountFromHash(input: CreateAccountFromHashInput): Promise<UserRecord> {
	const existing = await getUserByEmail(input.email);
	if (existing) throw new Error("email_taken");
	const user: UserRecord = {
		userid: genUserId(),
		name: input.name,
		email: input.email.trim().toLowerCase(),
		passwordHash: input.passwordHash,
		passwordSalt: input.passwordSalt,
		isSuperAdmin: !!input.isSuperAdmin,
		memberships: [],
		createdAt: new Date().toISOString(),
	};
	await kvPutJSON(key(user.userid), user);
	await kvPutJSON(emailKey(user.email), user.userid);
	return user;
}

/** Adds a membership in `communityId` to an existing account. Throws `already_member` if one exists (pending or active). */
export async function addMembership(user: UserRecord, communityId: string, role: CommunityRole, status: MembershipStatus): Promise<UserRecord> {
	if (membershipFor(user, communityId)) throw new Error("already_member");
	const membership: Membership = { communityId, role, status, suspended: false, joinedAt: new Date().toISOString() };
	user.memberships.push(membership);
	if (status === "active") user.lastActiveCommunityId = communityId;
	await putUser(user);
	await idxAppend(communityUsersIndex(communityId), user.userid);
	return user;
}

/**
 * Super Admin assigns an existing account as an org's Org Admin — creates an active membership if the
 * user has none there yet, or promotes/activates an existing (pending or player) membership. Unlike
 * `addMembership`, this never throws "already_member" — it's meant to work regardless of the user's
 * current relationship (if any) to that org.
 */
export async function assignOrgAdmin(userid: string, communityId: string): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	const existing = membershipFor(user, communityId);
	if (existing) {
		existing.role = "org_admin";
		existing.status = "active";
	} else {
		user.memberships.push({ communityId, role: "org_admin", status: "active", suspended: false, joinedAt: new Date().toISOString() });
		await idxAppend(communityUsersIndex(communityId), user.userid);
	}
	user.lastActiveCommunityId = communityId;
	await putUser(user);
	return user;
}

/**
 * Self-registration entry point (join-by-invite-code): if the email already has an account, verifies
 * the supplied password matches it and adds a new PENDING "player" membership — same identity, one more
 * org, awaiting that org's Org Admin approval. Otherwise creates a brand-new account first.
 */
export async function joinCommunity(input: { communityId: string; name: string; email: string; password: string }): Promise<UserRecord> {
	const existing = await getUserByEmail(input.email);
	if (existing) {
		const ok = await verifyPassword(input.password, existing.passwordHash, existing.passwordSalt);
		if (!ok) throw new Error("email_taken");
		return addMembership(existing, input.communityId, "player", "pending");
	}
	const user = await createAccount({ name: input.name, email: input.email, password: input.password });
	return addMembership(user, input.communityId, "player", "pending");
}

export async function verifyLogin(email: string, password: string): Promise<UserRecord | null> {
	const user = await getUserByEmail(email);
	if (!user) return null;
	const ok = await verifyPassword(password, user.passwordHash, user.passwordSalt);
	return ok ? user : null;
}

export async function putUser(user: UserRecord): Promise<void> {
	await kvPutJSON(key(user.userid), user);
}

export async function markNotificationsSeen(userid: string, tournamentId: string): Promise<void> {
	const user = await getUserById(userid);
	if (!user) return;
	user.notificationsSeenAt = { ...(user.notificationsSeenAt ?? {}), [tournamentId]: new Date().toISOString() };
	await putUser(user);
}

export async function setMembershipRole(userid: string, communityId: string, role: CommunityRole): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	const membership = membershipFor(user, communityId);
	if (!membership) return null;
	membership.role = role;
	await putUser(user);
	return user;
}

export async function setMembershipSuspended(userid: string, communityId: string, suspended: boolean): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	const membership = membershipFor(user, communityId);
	if (!membership) return null;
	membership.suspended = suspended;
	await putUser(user);
	return user;
}

/** Org Admin/Super Admin approves a pending join request. */
export async function approveMembership(userid: string, communityId: string): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	const membership = membershipFor(user, communityId);
	if (!membership || membership.status !== "pending") return null;
	membership.status = "active";
	user.lastActiveCommunityId = communityId;
	await putUser(user);
	return user;
}

/** Org Admin/Super Admin rejects a pending join request — the membership row is removed entirely. */
export async function rejectMembership(userid: string, communityId: string): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	const before = user.memberships.length;
	user.memberships = user.memberships.filter((m) => m.communityId !== communityId);
	if (user.memberships.length === before) return null;
	await putUser(user);
	await idxRemove(communityUsersIndex(communityId), userid);
	return user;
}

export async function setActiveCommunity(userid: string, communityId: string): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	const membership = membershipFor(user, communityId);
	if (!membership || membership.status !== "active") return null;
	user.lastActiveCommunityId = communityId;
	await putUser(user);
	return user;
}
