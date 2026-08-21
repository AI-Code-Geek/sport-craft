"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMe, getTournament } from "@/lib/api-client";
import { Card, LifecycleStepper } from "@/components/ui";
import type { Tournament } from "@/lib/types";

const ORGANIZER_TOOLS: [string, string, string, string][] = [
	["/app/admin/tournament", "⚙️", "Tournament settings", "Edit variables"],
	["/app/admin/poll", "🗳️", "Poll", "Open / close / freeze signup"],
	["/app/admin/captains", "👑", "Captains", "Pick captains, name teams"],
	["/app/admin/positions", "🏷️", "Positions", "Categorize remaining players"],
	["/app/admin/auction", "🔨", "Auction control", "Run the live position auction"],
	["/app/admin/schedule", "🗓️", "Schedule", "Generate & publish matches"],
	["/app/admin/scoring", "📟", "Live scoring", "Enter set scores"],
	["/app/admin/playoffs", "🏆", "Playoffs", "Set cutoff, generate bracket"],
];
const SUPER_ADMIN_TOOLS: [string, string, string, string][] = [
	["/app/admin/tournaments/new", "➕", "New tournament", "Create a tournament + core variables"],
	["/app/admin/organizers", "🧑‍💼", "Organizers", "Staff this tournament's committee"],
	["/app/admin/users", "🗂️", "Users", "Manage community members & roles"],
];

export default function AdminHomePage() {
	const [tournament, setTournament] = useState<Tournament | null>(null);
	const [isSuperAdmin, setIsSuperAdmin] = useState(false);

	useEffect(() => {
		fetchMe().then(async ({ data }) => {
			setIsSuperAdmin(data.roleContext?.isSuperAdmin ?? false);
			if (!data.tournamentId) return;
			const { data: t } = await getTournament(data.tournamentId);
			setTournament(t.tournament ?? null);
		});
	}, []);

	const tools = isSuperAdmin ? [...SUPER_ADMIN_TOOLS, ...ORGANIZER_TOOLS] : ORGANIZER_TOOLS;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Admin console</h1>
				<span className="text-xs text-muted">Signed in as {isSuperAdmin ? "Super Admin" : "Organizer"}</span>
			</div>

			{tournament ? (
				<Card title="Tournament progress">
					<LifecycleStepper status={tournament.status} />
				</Card>
			) : (
				<Card>
					<p className="text-sm text-muted">No tournament yet. {isSuperAdmin ? "Create one to get started." : "Ask a Super Admin to create one."}</p>
				</Card>
			)}

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{tools.map(([href, icon, label, sub]) => (
					<Link key={href} href={href} className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-2">
						<div className="text-2xl">{icon}</div>
						<div className="mt-1 font-semibold">{label}</div>
						<div className="text-xs text-muted">{sub}</div>
					</Link>
				))}
			</div>
		</div>
	);
}
