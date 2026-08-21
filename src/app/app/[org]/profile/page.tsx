"use client";

import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/api-client";
import { Card } from "@/components/ui";
import { initials } from "@/lib/format";
import type { PublicUser } from "@/lib/types";

export default function ProfilePage() {
	const [user, setUser] = useState<PublicUser | null>(null);
	const [role, setRole] = useState<{ isSuperAdmin: boolean; isOrgAdmin: boolean } | null>(null);
	const [prefs, setPrefs] = useState({ pollUpdates: true, myMatches: true, allScores: false, auctionTurn: true });
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		fetchMe().then(({ data }) => {
			setUser(data.user ?? null);
			setRole(data.roleContext ?? null);
		});
	}, []);

	if (!user) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Your profile</h1>
			<div className="grid gap-4 md:grid-cols-2">
				<Card title="Account">
					<div className="mb-3 flex items-center gap-3">
						<div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2 font-bold">{initials(user.name)}</div>
						<div>
							<div className="font-bold">{user.name}</div>
							<div className="text-sm text-muted">{user.email}</div>
						</div>
					</div>
					<div className="mb-2">
						<span className="rounded-md bg-neutral/20 px-2 py-0.5 text-xs font-bold uppercase text-neutral">
							{role?.isSuperAdmin ? "Super Admin" : role?.isOrgAdmin ? "Org Admin" : "Player"}
						</span>
					</div>
					<button className="btn-outline">Change password</button>
				</Card>
				<Card title="Notification preferences">
					<div className="flex flex-col gap-2 text-sm">
						{([
							["pollUpdates", "Poll opens / closing soon"],
							["myMatches", "My team's matches"],
							["allScores", "All league scores"],
							["auctionTurn", "Auction — my turn to bid"],
						] as const).map(([key, label]) => (
							<label key={key} className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={prefs[key]}
									onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
								/>
								{label}
							</label>
						))}
					</div>
					<button
						className="btn-secondary mt-3"
						onClick={() => {
							setSaved(true);
							setTimeout(() => setSaved(false), 2000);
						}}
					>
						Save preferences
					</button>
					{saved ? <span className="ml-2 text-xs text-ok">Saved.</span> : null}
				</Card>
			</div>
		</div>
	);
}
