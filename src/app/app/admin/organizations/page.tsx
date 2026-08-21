"use client";

import { useEffect, useState } from "react";
import { listOrgRequests, decideOrgRequest, listOrganizations, createOrganizationDirect, assignOrgAdmin, switchOrg, fetchMe } from "@/lib/api-client";
import type { OrgRequestView, OrganizationSummary } from "@/lib/api-client";
import { Card } from "@/components/ui";
import { FEATURE_LABELS, ALL_FEATURES_ENABLED } from "@/lib/types";
import type { FeatureKey, SportType } from "@/lib/types";

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

export default function OrganizationsConsolePage() {
	const [requests, setRequests] = useState<OrgRequestView[]>([]);
	const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
	const [busyId, setBusyId] = useState<string | null>(null);

	const [newOrgName, setNewOrgName] = useState("");
	const [newOrgSport, setNewOrgSport] = useState<SportType>("volleyball");
	const [newOrgFeatures, setNewOrgFeatures] = useState<Record<FeatureKey, boolean>>(ALL_FEATURES_ENABLED);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");

	const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
	const [assignBusy, setAssignBusy] = useState<string | null>(null);
	const [assignError, setAssignError] = useState<Record<string, string>>({});

	const [myUserId, setMyUserId] = useState<string | null>(null);
	const [switching, setSwitching] = useState<string | null>(null);

	async function load() {
		const [{ data: r }, { data: o }] = await Promise.all([listOrgRequests(), listOrganizations()]);
		setRequests(r.requests ?? []);
		setOrganizations(o.organizations ?? []);
	}

	useEffect(() => {
		load();
		fetchMe().then(({ data }) => setMyUserId(data.user?.userid ?? null));
	}, []);

	async function goToDashboard(communityId: string) {
		setSwitching(communityId);
		try {
			await switchOrg(communityId);
			window.location.href = "/app/admin";
		} finally {
			setSwitching(null);
		}
	}

	async function decide(id: string, action: "approve" | "reject") {
		setBusyId(id);
		try {
			await decideOrgRequest(id, action);
			await load();
		} finally {
			setBusyId(null);
		}
	}

	async function createDirect() {
		const name = newOrgName.trim();
		if (!name) return;
		setCreating(true);
		setCreateError("");
		try {
			const { ok, data } = await createOrganizationDirect(name, newOrgSport, newOrgFeatures);
			if (!ok) {
				setCreateError(data.error === "org_name_taken" ? "An organization with that name already exists." : "Couldn't create the organization.");
				return;
			}
			// You're added as this org's Org Admin, but your session cookie still points at whatever was
			// active before — switch into it now so /app/admin actually shows the new org immediately.
			await switchOrg(data.community.id);
			window.location.href = "/app/admin";
		} finally {
			setCreating(false);
		}
	}

	async function doAssign(communityId: string) {
		const email = (assignEmail[communityId] ?? "").trim();
		if (!email) return;
		setAssignBusy(communityId);
		setAssignError((prev) => ({ ...prev, [communityId]: "" }));
		try {
			const { ok, data } = await assignOrgAdmin(communityId, email);
			if (!ok) {
				setAssignError((prev) => ({
					...prev,
					[communityId]: data.error === "user_not_found" ? "No account with that email yet — they need to register first." : "Couldn't assign Org Admin.",
				}));
				return;
			}
			setAssignEmail((prev) => ({ ...prev, [communityId]: "" }));
			await load();
		} finally {
			setAssignBusy(null);
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

			<Card title="Create an organization directly">
				<p className="mb-3 text-xs text-muted">
					Skips the request queue — you become this org&apos;s founding Org Admin immediately.
				</p>
				{createError ? <p className="mb-3 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{createError}</p> : null}
				<div className="grid gap-3 md:grid-cols-2">
					<label className="flex flex-col gap-1 text-sm">
						<span className="text-xs text-muted">Organization name</span>
						<input className="input" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="Riverside Rec League" />
					</label>
					<label className="flex flex-col gap-1 text-sm">
						<span className="text-xs text-muted">Sport</span>
						<select className="input" value={newOrgSport} onChange={(e) => setNewOrgSport(e.target.value as SportType)}>
							<option value="volleyball">Volleyball</option>
							<option value="basketball">Basketball</option>
							<option value="soccer">Soccer</option>
							<option value="softball">Softball</option>
							<option value="pickleball">Pickleball</option>
							<option value="other">Other</option>
						</select>
					</label>
				</div>
				<div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface-2 p-3 md:grid-cols-4">
					{FEATURE_KEYS.map((k) => (
						<label key={k} className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={newOrgFeatures[k]}
								onChange={(e) => setNewOrgFeatures((prev) => ({ ...prev, [k]: e.target.checked }))}
							/>
							{FEATURE_LABELS[k]}
						</label>
					))}
				</div>
				<button className="btn-primary mt-3" disabled={creating || !newOrgName.trim()} onClick={createDirect}>
					{creating ? "Creating…" : "Create organization"}
				</button>
			</Card>

			<Card title="All organizations">
				<div className="flex flex-col divide-y divide-border">
					{organizations.map(({ community, memberCount, orgAdmins }) => {
						const iAmAdmin = myUserId != null && orgAdmins.some((a) => a.userid === myUserId);
						return (
						<div key={community.id} className="flex flex-col gap-2 py-3">
							<div className="flex items-center justify-between">
								<div>
									<button
										className="font-semibold text-brand underline-offset-2 hover:underline"
										disabled={switching === community.id}
										onClick={() => goToDashboard(community.id)}
									>
										{community.name}
									</button>{" "}
									<span className="text-xs font-normal text-muted">
										({community.sport}){iAmAdmin ? " · you're an Org Admin here" : ""}
									</span>
									<div className="text-xs text-muted">
										{memberCount} active member{memberCount === 1 ? "" : "s"} · Org Admins: {orgAdmins.length > 0 ? orgAdmins.map((a) => a.name).join(", ") : "none yet"}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<button className="btn-secondary" disabled={switching === community.id} onClick={() => goToDashboard(community.id)}>
										{switching === community.id ? "Opening…" : "Go to dashboard →"}
									</button>
									<code className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs">{community.inviteCode}</code>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<input
									className="input w-auto flex-1"
									placeholder="Assign Org Admin by email…"
									value={assignEmail[community.id] ?? ""}
									onChange={(e) => setAssignEmail((prev) => ({ ...prev, [community.id]: e.target.value }))}
								/>
								<button
									className="btn-outline"
									disabled={assignBusy === community.id || !(assignEmail[community.id] ?? "").trim()}
									onClick={() => doAssign(community.id)}
								>
									{assignBusy === community.id ? "Assigning…" : "Assign"}
								</button>
							</div>
							{assignError[community.id] ? <p className="text-xs text-bad">{assignError[community.id]}</p> : null}
						</div>
						);
					})}
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
