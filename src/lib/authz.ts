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

export async function getRoleContext(tournamentId: string, session: Session | null): Promise<RoleContext> {
	if (!session) return { isSuperAdmin: false, isOrgAdmin: false, canManage: false, captainTeamId: null };
	const tournament = await getTournament(tournamentId);
	const superAdmin = isSuperAdmin(session);
	const orgAdmin = !!tournament && isOrgAdminOf(session, tournament.communityId);
	const captainTeam = await isCaptain(tournamentId, session.userid);
	return {
		isSuperAdmin: superAdmin,
		isOrgAdmin: orgAdmin,
		canManage: superAdmin || orgAdmin,
		captainTeamId: captainTeam?.id ?? null,
	};
}
