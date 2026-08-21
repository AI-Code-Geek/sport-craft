/** Typed fetch wrappers for every /api/* route. Client-safe (no server-only imports). */
import type {
	PublicUser, Tournament, Poll, PollEntry, Team, RosterEntry, PositionsState, AuctionState,
	AuctionLogEntry, Match, StandingsRow, Bracket, AppNotification,
} from "./types";

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
	const res = await fetch(url, {
		...init,
		headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
	});
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	return { ok: res.ok, status: res.status, data };
}
const post = <T>(url: string, body?: unknown) => call<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = <T>(url: string, body?: unknown) => call<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
const get = <T>(url: string) => call<T>(url);

export interface RoleContext {
	isSuperAdmin: boolean;
	isOrganizer: boolean;
	canManage: boolean;
	captainTeamId: string | null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) => post<{ user: PublicUser }>("/api/auth/login", { email, password });
export const register = (name: string, email: string, password: string, inviteCode: string) =>
	post<{ user: PublicUser }>("/api/auth/register", { name, email, password, inviteCode });
export const logout = () => post<{ ok: boolean }>("/api/auth/logout");
export const fetchMe = () => get<{ user: PublicUser | null; tournamentId: string | null; roleContext: RoleContext | null }>("/api/me");

// ── Tournaments ───────────────────────────────────────────────────────────────
export const createTournament = (input: Record<string, unknown>) => post<{ tournament: Tournament }>("/api/tournaments", input);
export const listTournaments = () => get<{ tournaments: Tournament[] }>("/api/tournaments");
export const getTournament = (id: string) => get<{ tournament: Tournament }>(`/api/tournaments/${id}`);
export const updateTournament = (id: string, patchBody: Record<string, unknown>) => patch<{ tournament: Tournament }>(`/api/tournaments/${id}`, patchBody);

export const getOrganizers = (id: string) => get<{ organizers: PublicUser[]; candidates: PublicUser[] }>(`/api/tournaments/${id}/organizers`);
export const setOrganizer = (id: string, action: "add" | "remove", userId: string) =>
	post<{ organizerIds: string[] }>(`/api/tournaments/${id}/organizers`, { action, userId });

// ── Poll ──────────────────────────────────────────────────────────────────────
export interface PollEntryView extends PollEntry {
	name: string;
}
export interface PollView extends Omit<Poll, "entries"> {
	entries: PollEntryView[];
}
export const getPoll = (id: string) => get<{ poll: PollView | null; capacity: number }>(`/api/tournaments/${id}/poll`);
export const pollAction = (id: string, action: "open" | "close" | "freeze") => post<{ poll: Poll }>(`/api/tournaments/${id}/poll`, { action });
export const pollVote = (id: string, action: "join" | "withdraw", userId?: string) =>
	post<{ status?: string; ok?: boolean }>(`/api/tournaments/${id}/poll/vote`, { action, userId });
export const pollPromote = (id: string, userId: string) => post<{ poll: Poll }>(`/api/tournaments/${id}/poll/promote`, { userId });

// ── Teams / captains ──────────────────────────────────────────────────────────
export interface RosterEntryView extends RosterEntry {
	name: string;
}
export interface TeamView extends Omit<Team, "roster"> {
	captainName: string;
	roster: RosterEntryView[];
}
export const getTeams = (id: string) => get<{ teams: TeamView[] }>(`/api/tournaments/${id}/teams`);
export const getCaptainsData = (id: string) =>
	get<{ confirmed: { userId: string; name: string }[]; teams: Team[]; maxTeams: number; budgetPoints: number }>(`/api/tournaments/${id}/captains`);
export const setCaptains = (id: string, picks: { name: string; color: number; captainUserId: string }[]) =>
	post<{ teams: Team[] }>(`/api/tournaments/${id}/captains`, { picks });

// ── Positions ─────────────────────────────────────────────────────────────────
export interface PositionPlayerView {
	userId: string;
	name: string;
	category: string | null;
}
export const getPositions = (id: string) =>
	get<{ positions: PositionsState | null; players: PositionPlayerView[]; counts: Record<string, number>; target: number; allFull: boolean }>(`/api/tournaments/${id}/positions`);
export const assignPosition = (id: string, userId: string, category: string) =>
	post<{ positions: PositionsState; counts: Record<string, number> }>(`/api/tournaments/${id}/positions`, { userId, category });
export const finalizePositions = (id: string) => post<{ ok: boolean }>(`/api/tournaments/${id}/positions`, { finalize: true });

// ── Auction ───────────────────────────────────────────────────────────────────
export interface AuctionLogEntryView extends AuctionLogEntry {
	name: string;
}
export interface AuctionView extends Omit<AuctionState, "log"> {
	log: AuctionLogEntryView[];
	currentNomineeName: string | null;
	currentCategory: string | null;
	roundsCompleted: string[];
	roundsRemaining: string[];
	nominationQueueNames: string[];
}
export interface AuctionTeamView {
	id: string; name: string; color: number; budgetTotal: number; budgetRemaining: number; filled: number; needsCurrent: boolean;
}
export const getAuction = (id: string) => get<{ auction: AuctionView | null; teams: AuctionTeamView[] }>(`/api/tournaments/${id}/auction`);
export const auctionAction = (id: string, action: "start" | "pause") => post<{ auction: AuctionState }>(`/api/tournaments/${id}/auction`, { action });
export const placeBid = (id: string, amount: number) => post<{ auction: AuctionState }>(`/api/tournaments/${id}/auction/bid`, { amount });
export const resolveAuction = (id: string) => post<{ auction: AuctionState }>(`/api/tournaments/${id}/auction/resolve`);
export const skipNominee = (id: string) => post<{ auction: AuctionState }>(`/api/tournaments/${id}/auction/skip`);

// ── Schedule ──────────────────────────────────────────────────────────────────
export const getSchedule = (id: string) => get<{ matches: Match[] }>(`/api/tournaments/${id}/schedule`);
export const generateSchedule = (id: string, config: { venue: string; courts: string[]; times: string[]; startDate: string; daysBetween: number }) =>
	post<{ matches: Match[] }>(`/api/tournaments/${id}/schedule`, config);

// ── Scoring ───────────────────────────────────────────────────────────────────
export const getMatch = (id: string, matchId: string) => get<{ match: Match }>(`/api/tournaments/${id}/matches/${matchId}`);
export const scoreAction = (id: string, matchId: string, action: "point" | "undo" | "nextset" | "end", side?: "a" | "b") =>
	post<{ match: Match }>(`/api/tournaments/${id}/matches/${matchId}/score`, { action, side });

// ── Standings / bracket ───────────────────────────────────────────────────────
export const getStandings = (id: string) => get<{ standings: StandingsRow[]; playoffTeamCount: number }>(`/api/tournaments/${id}/standings`);
export const getBracket = (id: string) => get<{ bracket: Bracket | null }>(`/api/tournaments/${id}/bracket`);
export const generateBracket = (id: string, config: { venue: string; court: string; dates: string[] }) =>
	post<{ bracket: Bracket }>(`/api/tournaments/${id}/bracket`, config);

// ── Notifications ─────────────────────────────────────────────────────────────
export interface NotificationView extends AppNotification {
	unread: boolean;
}
export const getNotifications = (id: string) => get<{ notifications: NotificationView[]; unreadCount: number }>(`/api/tournaments/${id}/notifications`);
export const markNotificationsSeen = (id: string) => post<{ ok: boolean }>(`/api/tournaments/${id}/notifications`);

// ── Community users ───────────────────────────────────────────────────────────
export const getCommunityUsers = () => get<{ users: PublicUser[] }>("/api/community/users");
export const updateCommunityUser = (userId: string, patchBody: { role?: "super_admin" | "player"; suspended?: boolean }) =>
	patch<{ user: PublicUser }>("/api/community/users", { userId, ...patchBody });
