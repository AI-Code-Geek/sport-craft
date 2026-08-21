"use client";

import { useEffect, useState } from "react";
import { listOrgRequests, decideOrgRequest, listOrganizations } from "@/lib/api-client";
import type { OrgRequestView, OrganizationSummary } from "@/lib/api-client";
import { Card } from "@/components/ui";
import { FEATURE_LABELS } from "@/lib/types";
import type { FeatureKey } from "@/lib/types";

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

export default function OrganizationsConsolePage() {
	const [requests, setRequests] = useState<OrgRequestView[]>([]);
	const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
	const [busyId, setBusyId] = useState<string | null>(null);

	async function load() {
		const [{ data: r }, { data: o }] = await Promise.all([listOrgRequests(), listOrganizations()]);
		setRequests(r.requests ?? []);
		setOrganizations(o.organizations ?? []);
	}

	useEffect(() => {
		load();
	}, []);

	async function decide(id: string, action: "approve" | "reject") {
		setBusyId(id);
		try {
			await decideOrgRequest(id, action);
			await load();
		} finally {
			setBusyId(null);
		}
	}

	const pending = requests.filter((r) => r.status === "pending");
	const decided = requests.filter((r) => r.status !== "pending");

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Organizations</h1>
			<p className="text-sm text-muted">Platform Super Admin — review org-creation requests and see every org on the platform.</p>

			<Card title={`Pending requests (${pending.length})`}>
				{pending.length === 0 ? (
					<p className="text-sm text-muted">Nothing pending.</p>
				) : (
					<div className="flex flex-col divide-y divide-border">
						{pending.map((r) => (
							<div key={r.id} className="flex flex-col gap-2 py-3">
								<div className="flex items-center justify-between">
									<div>
										<div className="font-semibold">{r.orgName} <span className="text-xs font-normal text-muted">({r.sport})</span></div>
										<div className="text-xs text-muted">{r.requesterName} · {r.requesterEmail}</div>
									</div>
									<div className="flex gap-2">
										<button className="btn-secondary" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>Approve</button>
										<button className="btn-danger" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}>Reject</button>
									</div>
								</div>
								<div className="flex flex-wrap gap-1">
									{FEATURE_KEYS.filter((k) => r.features[k]).map((k) => (
										<span key={k} className="rounded-md bg-neutral/20 px-2 py-0.5 text-xs text-neutral">{FEATURE_LABELS[k]}</span>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			<Card title="All organizations">
				<div className="flex flex-col divide-y divide-border">
					{organizations.map(({ community, memberCount, orgAdmins }) => (
						<div key={community.id} className="flex items-center justify-between py-2">
							<div>
								<div className="font-semibold">{community.name} <span className="text-xs font-normal text-muted">({community.sport})</span></div>
								<div className="text-xs text-muted">
									{memberCount} active member{memberCount === 1 ? "" : "s"} · Org Admins: {orgAdmins.length > 0 ? orgAdmins.map((a) => a.name).join(", ") : "none yet"}
								</div>
							</div>
							<code className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs">{community.inviteCode}</code>
						</div>
					))}
					{organizations.length === 0 ? <p className="py-2 text-sm text-muted">No organizations yet.</p> : null}
				</div>
			</Card>

			{decided.length > 0 ? (
				<Card title="Decided requests">
					<div className="flex flex-col divide-y divide-border">
						{decided.map((r) => (
							<div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
								<span>{r.orgName} — {r.requesterEmail}</span>
								<span className={r.status === "approved" ? "text-ok" : "text-bad"}>{r.status}</span>
							</div>
						))}
					</div>
				</Card>
			) : null}
		</div>
	);
}
