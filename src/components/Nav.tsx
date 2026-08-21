"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMe, logout, getNotifications, markNotificationsSeen, switchOrg } from "@/lib/api-client";
import type { NotificationView, MembershipView } from "@/lib/api-client";
import type { PublicUser, FeatureKey } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

type RoleCtx = { isSuperAdmin: boolean; isOrgAdmin: boolean; canManage: boolean; captainTeamId: string | null };

/** `null` = always shown, no feature gate (e.g. Home). */
const PARTICIPANT_LINKS: [string, string, FeatureKey | null][] = [
	["/app", "Home", null],
	["/app/poll", "Poll", "poll"],
	["/app/teams", "Teams", "teams"],
	["/app/teams/mine", "My Team", "teams"],
	["/app/auction", "Auction", "auction"],
	["/app/schedule", "Schedule", "scheduler"],
	["/app/standings", "Standings", "scheduler"],
	["/app/bracket", "Bracket", "brackets"],
];

export function Nav() {
	const pathname = usePathname();
	const [user, setUser] = useState<PublicUser | null>(null);
	const [role, setRole] = useState<RoleCtx | null>(null);
	const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
	const [memberships, setMemberships] = useState<MembershipView[]>([]);
	const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null);
	const [communityId, setCommunityId] = useState<string | null>(null);
	const [tournamentId, setTournamentId] = useState<string | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [notifications, setNotifications] = useState<NotificationView[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [bellOpen, setBellOpen] = useState(false);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			setUser(data.user ?? null);
			setRole(data.roleContext ?? null);
			setIsPlatformSuperAdmin(data.isSuperAdmin ?? false);
			setMemberships(data.memberships ?? []);
			setFeatures(data.features ?? null);
			setCommunityId(data.communityId ?? null);
			setTournamentId(data.tournamentId ?? null);
			if (data.tournamentId) {
				const { data: n } = await getNotifications(data.tournamentId);
				setNotifications(n.notifications ?? []);
				setUnreadCount(n.unreadCount ?? 0);
			}
		});
	}, [pathname]);

	async function onSwitchOrg(id: string) {
		if (id === communityId) return;
		await switchOrg(id);
		window.location.href = "/app";
	}

	async function toggleBell() {
		const next = !bellOpen;
		setBellOpen(next);
		if (next && tournamentId && unreadCount > 0) {
			await markNotificationsSeen(tournamentId);
			setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
			setUnreadCount(0);
		}
	}

	function toggleTheme() {
		const el = document.documentElement;
		const next = el.getAttribute("data-theme") === "dark" ? "" : "dark";
		el.setAttribute("data-theme", next);
		localStorage.setItem("vb_theme", next);
	}

	async function signOut() {
		await logout();
		window.location.href = "/";
	}

	const linkCls = (href: string) => `text-sm ${pathname === href ? "font-semibold text-foreground" : "text-muted"}`;
	const canManage = role?.canManage ?? false;
	const isOrgAdmin = role?.isOrgAdmin ?? false;

	const adminLinks: [string, string][] = [];
	if (canManage) adminLinks.push(["/app/admin/tournaments/new", "New tournament"]);
	adminLinks.push(
		["/app/admin/tournament", "Tournament settings"],
		["/app/admin/poll", "Poll"],
		["/app/admin/captains", "Captains"],
		["/app/admin/positions", "Positions"],
		["/app/admin/auction", "Auction control"],
		["/app/admin/schedule", "Schedule"],
		["/app/admin/scoring", "Scoring"],
		["/app/admin/playoffs", "Playoffs"],
	);
	if (canManage) {
		adminLinks.push(["/app/admin/users", "Users"]);
		adminLinks.push(["/app/admin/settings", "Org settings"]);
	}

	const activeMemberships = memberships.filter((m) => m.status === "active");

	const initials = (user?.name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

	const links = (
		<>
			{PARTICIPANT_LINKS.filter(([, , featureKey]) => featureKey === null || features?.[featureKey] !== false).map(([href, label]) => (
				<Link key={href} href={href} className={linkCls(href)}>{label}</Link>
			))}
			{canManage ? <Link href="/app/admin" className={linkCls("/app/admin")}>Admin</Link> : null}
			{isPlatformSuperAdmin ? <Link href="/app/admin/organizations" className={linkCls("/app/admin/organizations")}>Organizations</Link> : null}
		</>
	);

	return (
		<nav className="sticky top-0 z-10 overflow-x-clip border-b border-border bg-surface px-4 py-3">
			<div className="flex items-center gap-3 md:gap-4">
				<Link href="/app" className="shrink-0 font-extrabold tracking-tight">
					🏐 Sport<span className="text-brand">Craft</span>
				</Link>
				<div className="hidden gap-4 md:flex">{links}</div>
				<div className="ml-auto flex min-w-0 items-center gap-2">
					{isPlatformSuperAdmin || isOrgAdmin ? (
						<span className="hidden rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted lg:inline">
							{isPlatformSuperAdmin ? "Super Admin" : "Org Admin"}
						</span>
					) : null}
					{activeMemberships.length > 1 ? (
						<select
							className="input hidden w-auto py-1 text-xs lg:block"
							value={communityId ?? ""}
							onChange={(e) => onSwitchOrg(e.target.value)}
							aria-label="Switch organization"
						>
							{activeMemberships.map((m) => (
								<option key={m.communityId} value={m.communityId}>{m.communityName}</option>
							))}
						</select>
					) : null}
					{role?.captainTeamId ? (
						<span className="hidden rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn lg:inline">
							Captain
						</span>
					) : null}
					{user ? (
						<span className="flex shrink-0 items-center gap-2" title={user.name}>
							<span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-xs font-semibold text-brand">
								{initials}
							</span>
							<span className="hidden text-xs text-muted lg:inline">{user.name}</span>
						</span>
					) : null}
					{tournamentId ? (
						<div className="relative">
							<button
								onClick={toggleBell}
								className="relative shrink-0 rounded-md border border-border px-2 py-1 text-sm"
								aria-label="Notifications"
							>
								🔔
								{unreadCount > 0 ? (
									<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
										{unreadCount > 9 ? "9+" : unreadCount}
									</span>
								) : null}
							</button>
							{bellOpen ? (
								<div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
									<div className="border-b border-border px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
										Notifications
									</div>
									<div className="max-h-96 overflow-y-auto">
										{notifications.length === 0 ? (
											<p className="px-3 py-6 text-center text-sm text-muted">Nothing yet.</p>
										) : (
											notifications.map((n) => (
												<div key={n.id} className={`border-b border-border px-3 py-2.5 last:border-b-0 ${n.unread ? "bg-brand/5" : ""}`}>
													<div className="flex items-start justify-between gap-2">
														<span className="text-sm font-semibold">{n.title}</span>
														{n.unread ? <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /> : null}
													</div>
													<p className="mt-0.5 text-xs text-muted">{n.message}</p>
													<p className="mt-1 text-[11px] text-muted">{fmtDateTime(n.createdAt)}</p>
												</div>
											))
										)}
									</div>
								</div>
							) : null}
						</div>
					) : null}
					<button onClick={toggleTheme} className="shrink-0 rounded-md border border-border px-2 py-1 text-sm" aria-label="Toggle theme">◐</button>
					<button onClick={signOut} className="hidden shrink-0 rounded-md border border-border px-2 py-1 text-sm md:block">Sign out</button>
					<button onClick={() => setMenuOpen((o) => !o)} className="shrink-0 rounded-md border border-border px-2 py-1 text-sm md:hidden" aria-label="Menu">
						{menuOpen ? "✕" : "☰"}
					</button>
				</div>
			</div>
			{menuOpen ? (
				<div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 md:hidden" onClick={() => setMenuOpen(false)}>
					{links}
					<button onClick={signOut} className="self-start rounded-md border border-border px-2 py-1 text-sm">Sign out</button>
				</div>
			) : null}
		</nav>
	);
}
