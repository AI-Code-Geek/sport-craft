/** Authorization helpers — the matrix from docs/DEVPLAN.md §4. Server-only. */
import { isOrganizer } from "./tournament-store";
import { isCaptain } from "./team-store";
import type { Session } from "./types";

export function isSuperAdmin(session: Session | null): boolean {
	return session?.role === "super_admin";
}

/** Super Admin OR an Organizer assigned to this specific tournament. */
export async function canManageTournament(tournamentId: string, session: Session | null): Promise<boolean> {
	if (!session) return false;
	if (isSuperAdmin(session)) return true;
	return isOrganizer(tournamentId, session.userid);
}

export interface RoleContext {
	isSuperAdmin: boolean;
	isOrganizer: boolean;
	canManage: boolean;
	captainTeamId: string | null;
}

export async function getRoleContext(tournamentId: string, session: Session | null): Promise<RoleContext> {
	if (!session) return { isSuperAdmin: false, isOrganizer: false, canManage: false, captainTeamId: null };
	const [organizer, captainTeam] = await Promise.all([
		isOrganizer(tournamentId, session.userid),
		isCaptain(tournamentId, session.userid),
	]);
	const superAdmin = isSuperAdmin(session);
	return {
		isSuperAdmin: superAdmin,
		isOrganizer: organizer,
		canManage: superAdmin || organizer,
		captainTeamId: captainTeam?.id ?? null,
	};
}
