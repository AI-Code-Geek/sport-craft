/**
 * User CRUD — KV keys: `user:<userid>`, `idx:email:<email>` -> userid, `idx:community-users:<communityId>` -> userid[].
 * Bootstrap rule (docs/DEVPLAN.md §4): the FIRST user to register into a brand-new community becomes
 * its `super_admin`; everyone after that joins as `player`.
 */
import { kvGetJSON, kvPutJSON, idxAppend, idxList } from "./kv";
import { genUserId } from "./ids";
import { hashPassword, verifyPassword } from "./password";
import type { UserRecord, CommunityRole } from "./types";

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

export async function listUsersByCommunity(communityId: string): Promise<UserRecord[]> {
	const ids = await idxList(communityUsersIndex(communityId));
	const users = await Promise.all(ids.map(getUserById));
	return users.filter((u): u is UserRecord => !!u).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface RegisterInput {
	communityId: string;
	name: string;
	email: string;
	password: string;
}

/** Register a new user. Throws if the email is already taken in ANY community. */
export async function registerUser(input: RegisterInput): Promise<UserRecord> {
	const existing = await getUserByEmail(input.email);
	if (existing) throw new Error("email_taken");

	const existingMembers = await idxList(communityUsersIndex(input.communityId));
	const role: CommunityRole = existingMembers.length === 0 ? "super_admin" : "player";

	const { hash, salt } = await hashPassword(input.password);
	const user: UserRecord = {
		userid: genUserId(),
		communityId: input.communityId,
		name: input.name,
		email: input.email.trim().toLowerCase(),
		passwordHash: hash,
		passwordSalt: salt,
		role,
		createdAt: new Date().toISOString(),
	};
	await kvPutJSON(key(user.userid), user);
	await kvPutJSON(emailKey(user.email), user.userid);
	await idxAppend(communityUsersIndex(input.communityId), user.userid);
	return user;
}

export async function verifyLogin(email: string, password: string): Promise<UserRecord | null> {
	const user = await getUserByEmail(email);
	if (!user) return null;
	if (user.suspended) return null;
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

export async function setUserRole(userid: string, role: CommunityRole): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	user.role = role;
	await putUser(user);
	return user;
}

export async function setUserSuspended(userid: string, suspended: boolean): Promise<UserRecord | null> {
	const user = await getUserById(userid);
	if (!user) return null;
	user.suspended = suspended;
	await putUser(user);
	return user;
}
