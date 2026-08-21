"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMe, getTournament } from "@/lib/api-client";
import { Card, LifecycleStepper } from "@/components/ui";
import type { Tournament, FeatureKey } from "@/lib/types";

/** `null` = always shown, no feature gate. Paths are relative to `/app/<org slug>/admin`. */
const ORG_ADMIN_TOOLS: [string, string, string, string, FeatureKey | null][] = [
	["tournaments/new", "➕", "New tournament", "Create a tournament + core variables", null],
	["tournament", "⚙️", "Tournament settings", "Edit variables", null],
	["poll", "🗳️", "Poll", "Open / close / freeze signup", "poll"],
	["captains", "👑", "Captains", "Pick captains, name teams", "teams"],
	["positions", "🏷️", "Positions", "Categorize remaining players", "positions"],
	["auction", "🔨", "Auction control", "Run the live position auction", "auction"],
	["schedule", "🗓️", "Schedule", "Generate & publish matches", "scheduler"],
	["scoring", "📟", "Live scoring", "Enter set scores", "liveScoring"],
	["playoffs", "🏆", "Playoffs", "Set cutoff, generate bracket", "brackets"],
	["users", "🗂️", "Users", "Manage members, roles & join requests", null],
	["settings", "🏢", "Org settings", "Organization name, sport & join code", null],
];

export default function AdminHomePage() {
	const { org } = useParams<{ org: string }>();
	const [tournament, setTournament] = useState<Tournament | null>(null);
	const [canManage, setCanManage] = useState(false);
	const [isOrgAdmin, setIsOrgAdmin] = useState(false);
	const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
	const [hasOrg, setHasOrg] = useState(true);
	const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			setCanManage(data.roleContext?.canManage ?? false);
			setIsOrgAdmin(data.roleContext?.isOrgAdmin ?? false);
			setIsPlatformSuperAdmin(data.isSuperAdmin ?? false);
			setHasOrg(!!data.communityId);
			setFeatures(data.features ?? null);
			if (!data.tournamentId) return;
			const { data: t } = await getTournament(data.tournamentId);
			setTournament(t.tournament ?? null);
		});
	}, []);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Admin console</h1>
				<span className="text-xs text-muted">Signed in as {isPlatformSuperAdmin ? "Super Admin" : isOrgAdmin ? "Org Admin" : "member"}</span>
			</div>

			{!hasOrg ? (
				<Card>
					<p className="text-sm text-muted">
						You&apos;re not an active member of any organization yet.
						{isPlatformSuperAdmin ? (
							<> As Super Admin, manage org-creation requests at <Link className="text-brand" href="/app/admin/organizations">Organizations</Link>.</>
						) : null}
					</p>
				</Card>
			) : tournament ? (
				<Card title="Tournament progress">
					<LifecycleStepper status={tournament.status} />
				</Card>
			) : (
				<Card>
					<p className="text-sm text-muted">No tournament yet. {canManage ? "Create one to get started." : "Ask your Org Admin to create one."}</p>
				</Card>
			)}

			{canManage ? (
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					{ORG_ADMIN_TOOLS.filter(([, , , , featureKey]) => featureKey === null || features?.[featureKey] !== false).map(([subPath, icon, label, sub]) => (
						<Link key={subPath} href={`/app/${org}/admin/${subPath}`} className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-2">
							<div className="text-2xl">{icon}</div>
							<div className="mt-1 font-semibold">{label}</div>
							<div className="text-xs text-muted">{sub}</div>
						</Link>
					))}
				</div>
			) : null}
		</div>
	);
}
