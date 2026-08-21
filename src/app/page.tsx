"use client";

import { useState } from "react";
import { login, register, submitOrgRequest } from "@/lib/api-client";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "@/lib/seed-client-hint";
import { FEATURE_LABELS, ALL_FEATURES_ENABLED } from "@/lib/types";
import type { FeatureKey, SportType } from "@/lib/types";

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];
const IS_DEV = process.env.NODE_ENV !== "production";

export default function LandingPage() {
	const [tab, setTab] = useState<"login" | "join" | "request">("login");
	const [email, setEmail] = useState(IS_DEV ? DEMO_ADMIN_EMAIL : "");
	const [password, setPassword] = useState(IS_DEV ? DEMO_PASSWORD : "");
	const [name, setName] = useState("");
	const [joinEmail, setJoinEmail] = useState("");
	const [joinPassword, setJoinPassword] = useState("");
	const [inviteCode, setInviteCode] = useState("");
	const [orgName, setOrgName] = useState("");
	const [orgSport, setOrgSport] = useState<SportType>("volleyball");
	const [orgFeatures, setOrgFeatures] = useState<Record<FeatureKey, boolean>>(ALL_FEATURES_ENABLED);
	const [ownerName, setOwnerName] = useState("");
	const [ownerEmail, setOwnerEmail] = useState("");
	const [ownerPassword, setOwnerPassword] = useState("");
	const [requestSubmitted, setRequestSubmitted] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function doLogin() {
		setBusy(true);
		setError("");
		const { ok, data } = await login(email, password);
		setBusy(false);
		if (!ok) return setError(data.error === "invalid_credentials" ? "Invalid email or password." : "Sign-in failed.");
		window.location.href = "/app";
	}

	async function doRegister() {
		setBusy(true);
		setError("");
		const { ok, data } = await register(name, joinEmail, joinPassword, inviteCode);
		setBusy(false);
		if (!ok) {
			const messages: Record<string, string> = {
				invalid_invite_code: "That invite code doesn't match any community.",
				already_member: "You're already a member of that community — try signing in instead.",
				email_taken: "That email is already registered with a different password.",
				password_too_short: "Password must be at least 8 characters.",
				missing_fields: "Please fill in every field.",
			};
			return setError(messages[data.error ?? ""] ?? "Registration failed.");
		}
		window.location.href = "/app";
	}

	async function doRequestOrg() {
		setBusy(true);
		setError("");
		const { ok, data } = await submitOrgRequest(orgName, orgSport, orgFeatures, ownerName, ownerEmail, ownerPassword);
		setBusy(false);
		if (!ok) {
			const messages: Record<string, string> = {
				org_name_taken: "An organization with that name already exists or is already pending.",
				password_too_short: "Password must be at least 8 characters.",
				missing_fields: "Please fill in every field.",
			};
			return setError(messages[data.error ?? ""] ?? "Couldn't submit the request.");
		}
		setRequestSubmitted(true);
	}

	return (
		<div className="mx-auto max-w-md px-4 py-16">
			<div className="mb-4 text-center text-3xl">🏐</div>
			<div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
				<h1 className="mb-1 text-2xl font-extrabold">
					Sport<span className="text-brand">Craft</span>
				</h1>
				<p className="mb-5 text-sm text-muted">Multi-sport community league platform — poll, teams, auction, schedule & live scores.</p>

				<div className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
					<button
						onClick={() => setTab("login")}
						className={`flex-1 rounded-md py-1.5 font-medium ${tab === "login" ? "bg-surface shadow-sm" : "text-muted"}`}
					>
						Log in
					</button>
					<button
						onClick={() => setTab("join")}
						className={`flex-1 rounded-md py-1.5 font-medium ${tab === "join" ? "bg-surface shadow-sm" : "text-muted"}`}
					>
						Join a community
					</button>
					<button
						onClick={() => setTab("request")}
						className={`flex-1 rounded-md py-1.5 font-medium ${tab === "request" ? "bg-surface shadow-sm" : "text-muted"}`}
					>
						Request an org
					</button>
				</div>

				{error ? <p className="mb-3 rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p> : null}

				{tab === "login" ? (
					<div className="flex flex-col gap-3">
						<Field label="Email">
							<input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
						</Field>
						<Field label="Password">
							<input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
						</Field>
						<button disabled={busy} onClick={doLogin} className="btn-primary">
							Sign in →
						</button>
						{IS_DEV ? (
							<p className="text-xs text-muted">
								Demo super admin: <span className="mono">{DEMO_ADMIN_EMAIL}</span> / <span className="mono">{DEMO_PASSWORD}</span>
							</p>
						) : null}
					</div>
				) : tab === "join" ? (
					<div className="flex flex-col gap-3">
						<p className="text-xs text-muted">
							Joining with an email that already has an account (elsewhere) adds this org to it — same login, more orgs.
						</p>
						<Field label="Your name">
							<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
						</Field>
						<Field label="Email">
							<input className="input" value={joinEmail} onChange={(e) => setJoinEmail(e.target.value)} placeholder="you@example.com" />
						</Field>
						<Field label="Password">
							<input className="input" type="password" value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="8+ characters" />
						</Field>
						<Field label="Community invite code">
							<input className="input mono" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
						</Field>
						<button disabled={busy} onClick={doRegister} className="btn-secondary">
							Create account & join →
						</button>
						<p className="text-xs text-muted">Your request joins as a Player, pending that org&apos;s Org Admin approval.</p>
					</div>
				) : requestSubmitted ? (
					<div className="flex flex-col gap-2 rounded-lg bg-ok/10 px-3 py-4 text-sm">
						<p className="font-medium">Request submitted.</p>
						<p className="text-muted">
							A platform Super Admin will review &ldquo;{orgName}&rdquo;. Once approved, sign in with the email and password you just gave —
							you&apos;ll be that org&apos;s founding Org Admin.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<p className="text-xs text-muted">Sits pending until a platform Super Admin approves it. Once approved, you become its founding Org Admin.</p>
						<Field label="Organization name">
							<input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Riverside Rec League" />
						</Field>
						<Field label="Sport">
							<select className="input" value={orgSport} onChange={(e) => setOrgSport(e.target.value as SportType)}>
								<option value="volleyball">Volleyball</option>
								<option value="basketball">Basketball</option>
								<option value="soccer">Soccer</option>
								<option value="softball">Softball</option>
								<option value="pickleball">Pickleball</option>
								<option value="other">Other</option>
							</select>
						</Field>
						<Field label="Features to enable">
							<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-border bg-surface-2 p-3">
								{FEATURE_KEYS.map((k) => (
									<label key={k} className="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											checked={orgFeatures[k]}
											onChange={(e) => setOrgFeatures((prev) => ({ ...prev, [k]: e.target.checked }))}
										/>
										{FEATURE_LABELS[k]}
									</label>
								))}
							</div>
						</Field>
						<Field label="Your name">
							<input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Jane Doe" />
						</Field>
						<Field label="Email">
							<input className="input" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@example.com" />
						</Field>
						<Field label="Password">
							<input className="input" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="8+ characters" />
						</Field>
						<button disabled={busy} onClick={doRequestOrg} className="btn-primary">
							Submit request →
						</button>
					</div>
				)}
			</div>
			<p className="mt-4 text-center text-xs text-muted">Run your league. Any sport, any org.</p>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1 text-sm">
			<span className="text-xs text-muted">{label}</span>
			{children}
		</label>
	);
}
