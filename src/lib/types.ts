/**
 * Domain types for the Estancia Volleyball League. Everything is stored in a single Cloudflare KV
 * namespace (see src/lib/kv.ts + the per-domain *-store.ts files) — no D1/database, per docs/DEVPLAN.md
 * §3. Each type below is the shape of one KV value (a JSON blob); most are one blob per tournament.
 */

// ── Community & users ────────────────────────────────────────────────────────

export interface Community {
	id: string;
	name: string;
	slug: string;
	inviteCode: string;
	createdAt: string;
}

/** Community-wide role. "organizer" and "captain" are DERIVED per-tournament, not stored here. */
export type CommunityRole = "super_admin" | "player";

export interface UserRecord {
	userid: string;
	communityId: string;
	name: string;
	email: string;
	passwordHash: string;
	passwordSalt: string;
	role: CommunityRole;
	createdAt: string;
	lastLoginAt?: string;
	suspended?: boolean;
	/** tournamentId -> ISO timestamp of the last time this user opened their notification bell for it. */
	notificationsSeenAt?: Record<string, string>;
}

export function publicUser(u: UserRecord) {
	const { passwordHash, passwordSalt, ...rest } = u;
	void passwordHash;
	void passwordSalt;
	return rest;
}
export type PublicUser = ReturnType<typeof publicUser>;

/** Self-verifying signed-cookie session payload (no per-request KV read). */
export interface Session {
	userid: string;
	communityId: string;
	role: CommunityRole;
	/** epoch seconds */
	exp: number;
}

// ── Tournament ────────────────────────────────────────────────────────────────

export type TournamentStatus =
	| "draft"
	| "poll_open"
	| "poll_closed"
	| "captains_selected"
	| "positions_set"
	| "auction_live"
	| "auction_complete"
	| "schedule_published"
	| "in_progress"
	| "playoffs"
	| "completed";

export interface Tournament {
	id: string;
	communityId: string;
	name: string;
	status: TournamentStatus;
	maxTeams: number;
	teamSize: number;
	budgetPoints: number;
	pollCapacity: number;
	setsToWin: number;
	pointsPerSet: number;
	winBy: number;
	playoffTeamCount: number;
	pollOpenedAt: string | null;
	pollClosedAt: string | null;
	createdBy: string;
	createdAt: string;
}

/** Position categories, one per remaining roster slot (teamSize - 1). Default volleyball set. */
export function defaultPositions(teamSize: number): string[] {
	const base = ["Setter", "Spiker 1", "Spiker 2", "Back Player 1", "Back Player 2", "Back Player 3", "Utility 1", "Utility 2"];
	return base.slice(0, Math.max(0, teamSize - 1));
}

// ── Poll ──────────────────────────────────────────────────────────────────────

export type PollEntryStatus = "confirmed" | "waitlisted" | "withdrawn";

export interface PollEntry {
	userId: string;
	status: PollEntryStatus;
	submittedAt: string;
}

export interface Poll {
	tournamentId: string;
	capacity: number;
	openedAt: string | null;
	closedAt: string | null;
	frozen: boolean;
	entries: PollEntry[];
}

// ── Teams / roster ────────────────────────────────────────────────────────────

export interface RosterEntry {
	userId: string;
	role: "captain" | "bid";
	position: string; // "Captain" for the captain slot, else a position_categories name
	soldPrice: number | null;
}

export interface Team {
	id: string;
	tournamentId: string;
	name: string;
	color: number; // 1-8, indexes a CSS palette
	captainUserId: string;
	budgetTotal: number;
	budgetRemaining: number;
	roster: RosterEntry[];
}

// ── Position categorization ──────────────────────────────────────────────────

export interface PositionsState {
	tournamentId: string;
	categories: string[];
	/** userId -> category name, for every confirmed non-captain player. */
	assignment: Record<string, string>;
}

// ── Auction ───────────────────────────────────────────────────────────────────

export type AuctionStatus = "not_started" | "live" | "paused" | "complete";

export interface AuctionLogEntry {
	userId: string;
	teamId: string;
	position: string;
	amount: number;
	result: "sold" | "bidding";
	at: string;
}

export interface AuctionState {
	tournamentId: string;
	status: AuctionStatus;
	/** position categories in the order they're auctioned. */
	roundOrder: string[];
	currentRoundIndex: number;
	/** userIds still to be nominated in the CURRENT round, in nomination order. */
	nominationQueue: string[];
	/** userId currently on the block, or null between rounds / before start. */
	currentNominee: string | null;
	currentBid: { amount: number; teamId: string } | null;
	log: AuctionLogEntry[];
}

// ── Matches / scoring ─────────────────────────────────────────────────────────

export type MatchRound = "group" | "semifinal" | "final";
export type MatchStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface SetScore {
	setNumber: number;
	a: number;
	b: number;
	status: "in_progress" | "completed";
}

export interface Match {
	id: string;
	tournamentId: string;
	round: MatchRound;
	teamAId: string;
	teamBId: string;
	scheduledAt: string;
	venue: string;
	court: string;
	status: MatchStatus;
	sets: SetScore[];
	winnerTeamId: string | null;
}

// ── Standings (computed, never persisted) ───────────────────────────────────

export interface StandingsRow {
	teamId: string;
	played: number;
	won: number;
	lost: number;
	setsWon: number;
	setsLost: number;
	pointsFor: number;
	pointsAgainst: number;
	leaguePoints: number;
	rank: number;
}

// ── Bracket ───────────────────────────────────────────────────────────────────

export interface BracketMatch {
	seedA: number | null;
	seedB: number | null;
	teamAId: string | null;
	teamBId: string | null;
	matchId: string | null;
}

export interface BracketRound {
	name: string;
	matches: BracketMatch[];
}

export interface Bracket {
	tournamentId: string;
	playoffTeamCount: number;
	provisional: boolean;
	rounds: BracketRound[];
}

// ── Notifications ─────────────────────────────────────────────────────────────

/** Who a notification is relevant to. "organizers" = Super Admin + this tournament's Organizers. */
export type NotificationAudience = "all" | "confirmed" | "captains" | "organizers";

export type NotificationType =
	| "tournament_created" | "poll_opened" | "poll_closed" | "captains_selected"
	| "positions_set" | "auction_started" | "auction_complete" | "schedule_published" | "playoffs_set";

export interface AppNotification {
	id: string;
	tournamentId: string;
	type: NotificationType;
	title: string;
	message: string;
	audience: NotificationAudience;
	createdAt: string;
}
