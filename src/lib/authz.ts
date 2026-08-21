/** Authorization helpers — the matrix from docs/DEVPLAN.md §4. Server-only. */
import { getTournament } from "./tournament-store";
import { isCaptain } from "./team-store";
import type { Session } from "./types";

export function isSuperAdmin(session: Session | null): boolean {
	return !!session?.isSuperAdmin;
}

/** True if this session's ACTIVE org matches `communityId` and its role there is "org_admin". */
export function isOrgAdminOf(session: Session | null, communityId: string): boolean {
	return !!session && session.communityId === communityId && session.role === "org_admin";
}

/** Platform Super Admin OR this tournament's org's Org Admin. */
export async function canManageTournament(tournamentId: string, session: Session | null): Promise<boolean> {
	if (!session) return false;
	if (isSuperAdmin(session)) return true;
	const tournament = await getTournament(tournamentId);
	return !!tournament && isOrgAdminOf(session, tournament.communityId);
}

export interface RoleContext {
	isSuperAdmin: boolean;
	isOrgAdmin: boolean;
	canManage: boolean;
	captainTeamId: string | null;
}

/**
 * `isSuperAdmin`/`isOrgAdmin`/`canManage` only need the session's ACTIVE org — never a tournament, so
 * these are available even when the org has no tournament yet (otherwise nobody could ever create the
 * FIRST one: the admin console needs `canManage` to decide whether to show that button at all).
 * `captainTeamId` genuinely needs a specific tournament to check against; pass `tournamentId` when
 * there is one. Callers passing a tournamentId must already have verified it belongs to this session's
 * active org (see e.g. the notifications route) — this trusts that check rather than repeating it.
 */
export async function getRoleContext(session: Session | null, tournamentId?: string): Promise<RoleContext> {
	if (!session || !session.communityId) return { isSuperAdmin: false, isOrgAdmin: false, canManage: false, captainTeamId: null };
	const superAdmin = isSuperAdmin(session);
	const orgAdmin = isOrgAdminOf(session, session.communityId);
	let captainTeamId: string | null = null;
	if (tournamentId) {
		const captainTeam = await isCaptain(tournamentId, session.userid);
		captainTeamId = captainTeam?.id ?? null;
	}
	return {
		isSuperAdmin: superAdmin,
		isOrgAdmin: orgAdmin,
		canManage: superAdmin || orgAdmin,
		captainTeamId,
	};
}
