"use client";

import { useEffect, useState } from "react";
import { getCommunitySettings, updateCommunitySettings, getCommunityUsers } from "@/lib/api-client";
import { Card, Stat } from "@/components/ui";
import { FEATURE_LABELS } from "@/lib/types";
import type { Community, PublicUser, SportType, FeatureKey } from "@/lib/types";

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

const SPORT_LABELS: Record<SportType, string> = {
	volleyball: "Volleyball",
	basketball: "Basketball",
	soccer: "Soccer",
	softball: "Softball",
	pickleball: "Pickleball",
	other: "Other",
};

export default function CommunitySettingsPage() {
	const [community, setCommunity] = useState<Community | null>(null);
	const [members, setMembers] = useState<PublicUser[]>([]);
	const [pending, setPending] = useState<PublicUser[]>([]);
	const [name, setName] = useState("");
	const [sport, setSport] = useState<SportType>("volleyball");
	const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null);
	const [saving, setSaving] = useState(false);
	const [savingSport, setSavingSport] = useState(false);
	const [savingFeature, setSavingFeature] = useState<FeatureKey | null>(null);
	const [regenerating, setRegenerating] = useState(false);
	const [copied, setCopied] = useState(false);

	async function load() {
		const [{ data: c }, { data: u }] = await Promise.all([getCommunitySettings(), getCommunityUsers()]);
		if (c.community) {
			setCommunity(c.community);
			setName(c.community.name);
			setSport(c.community.sport);
			setFeatures(c.community.features);
		}
		setMembers(u.members ?? []);
		setPending(u.pending ?? []);
	}

	useEffect(() => {
		load();
	}, []);

	async function saveName() {
		const trimmed = name.trim();
		if (!trimmed || trimmed === community?.name) return;
		setSaving(true);
		try {
			await updateCommunitySettings({ name: trimmed });
			await load();
		} finally {
			setSaving(false);
		}
	}

	async function saveSport(next: SportType) {
		setSport(next);
		setSavingSport(true);
		try {
			await updateCommunitySettings({ sport: next });
			await load();
		} finally {
			setSavingSport(false);
		}
	}

	async function toggleFeature(key: FeatureKey) {
		if (!features) return;
		const next = !features[key];
		setFeatures({ ...features, [key]: next });
		setSavingFeature(key);
		try {
			await updateCommunitySettings({ features: { [key]: next } });
			await load();
		} finally {
			setSavingFeature(null);
		}
	}

	async function regenerateCode() {
		if (!confirm("Regenerate the organization code? Anyone who hasn't registered yet will need the new code.")) return;
		setRegenerating(true);
		try {
			await updateCommunitySettings({ regenerateInviteCode: true });
			await load();
		} finally {
			setRegenerating(false);
		}
	}

	async function copyCode() {
		if (!community) return;
		await navigator.clipboard.writeText(community.inviteCode);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}

	const orgAdminCount = members.filter((u) => u.role === "org_admin").length;
	const playerCount = members.filter((u) => u.role === "player").length;
	const suspendedCount = members.filter((u) => u.suspended).length;

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Organization settings</h1>
			<p className="text-sm text-muted">Org Admin / Super Admin — the organization identity and join code new members register against.</p>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card title="Organization name">
					<div className="flex flex-col gap-2">
						<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" />
						<button className="btn-primary self-start" disabled={saving || !name.trim() || name.trim() === community?.name} onClick={saveName}>
							{saving ? "Saving…" : "Save name"}
						</button>
					</div>
				</Card>

				<Card title="Sport">
					<div className="flex flex-col gap-2">
						<select className="input" value={sport} onChange={(e) => saveSport(e.target.value as SportType)} disabled={savingSport}>
							{Object.entries(SPORT_LABELS).map(([value, label]) => (
								<option key={value} value={value}>{label}</option>
							))}
						</select>
						<p className="text-xs text-muted">Only Volleyball is fully wired up today (positions, set scoring); other sports are stored as org metadata.</p>
					</div>
				</Card>

				<Card title="Features" className="lg:col-span-2">
					<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 md:grid-cols-4">
						{FEATURE_KEYS.map((k) => (
							<label key={k} className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={features?.[k] ?? false}
									disabled={savingFeature === k}
									onChange={() => toggleFeature(k)}
								/>
								{FEATURE_LABELS[k]}
							</label>
						))}
					</div>
					<p className="mt-3 text-xs text-muted">Disabled features are hidden from the nav and admin console for everyone in this org.</p>
				</Card>

				<Card title="Organization code">
					<div className="flex flex-col gap-2">
						<p className="text-xs text-muted">New members enter this on the &ldquo;Join a community&rdquo; tab at registration.</p>
						<div className="flex items-center gap-2">
							<code className="rounded-md border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm tracking-wider">
								{community?.inviteCode ?? "…"}
							</code>
							<button className="btn-outline" onClick={copyCode}>{copied ? "Copied!" : "Copy"}</button>
						</div>
						<button className="btn-danger self-start" disabled={regenerating} onClick={regenerateCode}>
							{regenerating ? "Regenerating…" : "Regenerate code"}
						</button>
					</div>
				</Card>
			</div>

			<Card title="Role overview">
				<div className="grid grid-cols-4 gap-3">
					<Stat value={orgAdminCount} label="Org Admins" />
					<Stat value={playerCount} label="Players" />
					<Stat value={suspendedCount} label="Suspended" />
					<Stat value={pending.length} label="Pending requests" />
				</div>
				<p className="mt-3 text-xs text-muted">Manage individual roles, suspensions, and pending join requests on the Users page.</p>
			</Card>
		</div>
	);
}
