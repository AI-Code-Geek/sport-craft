/**
 * Domain types for SportCraft. Everything is stored in a single Cloudflare KV
 * namespace (see src/lib/kv.ts + the per-domain *-store.ts files) — no D1/database, per docs/DEVPLAN.md
 * §3. Each type below is the shape of one KV value (a JSON blob); most are one blob per tournament.
 */

// ── Community & users ────────────────────────────────────────────────────────

/** Which sport this organization runs. Only "volleyball" is fully wired up (positions, set scoring); the
 *  others are accepted as org metadata today so sport-craft can label multi-sport orgs correctly later. */
export type SportType = "volleyball" | "basketball" | "soccer" | "softball" | "pickleball" | "other";

/**
 * Which modules an org has turned on. Chosen when the org is requested/created, editable later from
 * Org Settings. Nav links and the admin console tool grid are gated by these; the underlying
 * tournament-store engine itself is unaffected — this only controls what's exposed in the UI.
 */
export type FeatureKey = "poll" | "scheduler" | "teams" | "positions" | "auction" | "liveScoring" | "brackets" | "notifications";

export const FEATURE_LABELS: Record<FeatureKey, string> = {
	poll: "Poll signup",
	scheduler: "Scheduling",
	teams: "Team creation",
	positions: "Position categorization",
	auction: "Live auction",
	liveScoring: "Live scoring",
	brackets: "Playoff brackets",
	notifications: "Notifications",
};

export const ALL_FEATURES_ENABLED: Record<FeatureKey, boolean> = {
	poll: true, scheduler: true, teams: true, positions: true, auction: true, liveScoring: true, brackets: true, notifications: true,
};

export interface Community {
	id: string;
	name: string;
	slug: string;
	sport: SportType;
	features: Record<FeatureKey, boolean>;
	inviteCode: string;
	createdAt: string;
}

/**
 * A public "create my organization" submission, gated on Super Admin approval before the org (or the
 * requester's account, if they don't already have one) is actually created. The requester's password is
 * hashed at submission time — never held in plaintext while pending. On approval, the requester becomes
 * that org's founding Org Admin.
 */
export type OrgRequestStatus = "pending" | "approved" | "rejected";

export interface OrganizationRequest {
	id: string;
	orgName: string;
	sport: SportType;
	features: Record<FeatureKey, boolean>;
	requesterName: string;
	requesterEmail: string;
	requesterPasswordHash: string;
	requesterPasswordSalt: string;
	status: OrgRequestStatus;
	/** Set once approved. */
	communityId?: string;
	createdAt: string;
	decidedAt?: string;
	decidedBy?: string;
}

/**
 * Role within ONE org (membership-scoped, not a whole-account property — an account can hold a
 * different role in each org it belongs to). "org_admin" can create/run that org's tournaments;
 * "player" is the default role a self-registered member gets. Platform Super Admin is a SEPARATE,
 * account-level flag (`UserRecord.isSuperAdmin`) — it is orthogonal to org membership entirely.
 */
export type CommunityRole = "org_admin" | "player";

/**
 * "pending" = a self-submitted join request awaiting that org's Org Admin approval — no access to the
 * org's data yet. "active" = approved (or created pre-approved, e.g. the founding Org Admin from an
 * approved org-creation request). There is no self-service path directly to "active".
 */
export type MembershipStatus = "pending" | "active";

/** One account's relationship to one org. An account holds zero or more of these. */
export interface Membership {
	communityId: string;
	role: CommunityRole;
	status: MembershipStatus;
	suspended: boolean;
	joinedAt: string;
}

export interface UserRecord {
	userid: string;
	name: string;
	email: string;
	passwordHash: string;
	passwordSalt: string;
	/** Platform-level role. Only ever set by seeding — there is no self-service or in-app path to become
	 *  one. Can create organizations and assign/reassign each org's Org Admin. */
	isSuperAdmin: boolean;
	memberships: Membership[];
	/** Which org's context to resume into on next login / on `/api/me` when not otherwise specified. */
	lastActiveCommunityId?: string;
	createdAt: string;
	lastLoginAt?: string;
	/** tournamentId -> ISO timestamp of the last time this user opened their notification bell for it. */
	notificationsSeenAt?: Record<string, string>;
}

/**
 * Public projection of a user. When `communityId` is given, `role`/`suspended`/`joinedAt` reflect that
 * SPECIFIC org's membership (or the "no membership there" defaults); omit it for identity-only views
 * (e.g. a platform Super Admin's own account, which may have no membership context at all).
 */
export function publicUser(u: UserRecord, communityId?: string) {
	const membership = communityId ? u.memberships.find((m) => m.communityId === communityId) : undefined;
	return {
		userid: u.userid,
		name: u.name,
		email: u.email,
		isSuperAdmin: u.isSuperAdmin,
		role: membership?.role ?? null,
		status: membership?.status ?? null,
		suspended: membership?.suspended ?? false,
		joinedAt: membership?.joinedAt ?? null,
		createdAt: u.createdAt,
	};
}
export type PublicUser = ReturnType<typeof publicUser>;

/**
 * Self-verifying signed-cookie session payload (no per-request KV read). `isSuperAdmin` is carried
 * here (not re-derived from KV) so platform-admin checks stay a pure signature+expiry check, same as
 * everything else this token guards. `communityId`/`role` describe the ACTIVE org for this session —
 * null when the account has no memberships yet, or (for a pure platform Super Admin) hasn't entered
 * an org. Switching orgs re-signs a new token via `/api/me/switch-org`; it does not require re-login.
 */
export interface Session {
	userid: string;
	isSuperAdmin: boolean;
	communityId: string | null;
	role: CommunityRole | null;
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

/** Who a notification is relevant to. "org_admins" = Super Admin + this tournament's Org Admins. */
export type NotificationAudience = "all" | "confirmed" | "captains" | "org_admins";

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
