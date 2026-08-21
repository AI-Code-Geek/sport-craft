"use client";

import { useEffect, useState } from "react";
import { getCommunityUsers, updateCommunityUser } from "@/lib/api-client";
import { Card } from "@/components/ui";
import type { PublicUser } from "@/lib/types";

export default function AdminUsersPage() {
	const [members, setMembers] = useState<PublicUser[]>([]);
	const [pending, setPending] = useState<PublicUser[]>([]);
	const [query, setQuery] = useState("");

	async function load() {
		const { data } = await getCommunityUsers();
		setMembers(data.members ?? []);
		setPending(data.pending ?? []);
	}

	useEffect(() => {
		load();
	}, []);

	async function toggleRole(u: PublicUser) {
		await updateCommunityUser(u.userid, { role: u.role === "org_admin" ? "player" : "org_admin" });
		await load();
	}
	async function toggleSuspend(u: PublicUser) {
		await updateCommunityUser(u.userid, { suspended: !u.suspended });
		await load();
	}
	async function decide(u: PublicUser, decision: "approve" | "reject") {
		await updateCommunityUser(u.userid, { decision });
		await load();
	}

	const filtered = members.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()));

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-xl font-bold">Community members</h1>
				<input className="input w-auto" placeholder="Search members…" value={query} onChange={(e) => setQuery(e.target.value)} />
			</div>

			{pending.length > 0 ? (
				<Card title={`Pending join requests (${pending.length})`}>
					<div className="flex flex-col divide-y divide-border">
						{pending.map((u) => (
							<div key={u.userid} className="flex items-center justify-between py-2">
								<div>
									<div>{u.name}</div>
									<div className="text-xs text-muted">{u.email}</div>
								</div>
								<div className="flex gap-2">
									<button className="btn-secondary" onClick={() => decide(u, "approve")}>Approve</button>
									<button className="btn-danger" onClick={() => decide(u, "reject")}>Reject</button>
								</div>
							</div>
						))}
					</div>
				</Card>
			) : null}

			<Card>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-muted">
							<tr><th className="pb-2 pr-2">Name</th><th className="pb-2 pr-2">Email</th><th className="pb-2 pr-2">Role</th><th className="pb-2 text-right">Actions</th></tr>
						</thead>
						<tbody>
							{filtered.map((u) => (
								<tr key={u.userid} className="border-t border-border">
									<td className="py-1.5 pr-2">{u.name}{u.suspended ? <span className="ml-1 text-xs text-bad">(suspended)</span> : null}</td>
									<td className="py-1.5 pr-2 text-xs text-muted">{u.email}</td>
									<td className="py-1.5 pr-2">
										<span className="rounded-md bg-neutral/20 px-2 py-0.5 text-xs font-bold uppercase text-neutral">{u.role === "org_admin" ? "Org Admin" : "Player"}</span>
									</td>
									<td className="py-1.5 text-right">
										<button className="btn-outline mr-2" onClick={() => toggleRole(u)}>{u.role === "org_admin" ? "Make player" : "Make org admin"}</button>
										<button className="btn-outline" onClick={() => toggleSuspend(u)}>{u.suspended ? "Unsuspend" : "Suspend"}</button>
									</td>
								</tr>
							))}
							{filtered.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-muted">No members found.</td></tr> : null}
						</tbody>
					</table>
				</div>
			</Card>
			<p className="text-xs text-muted">Showing {filtered.length} of {members.length} active community members.</p>
		</div>
	);
}
