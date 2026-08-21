"use client";

import { useState } from "react";
import { login, register } from "@/lib/api-client";
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from "@/lib/seed-client-hint";

export default function LandingPage() {
	const [tab, setTab] = useState<"login" | "join">("login");
	const [email, setEmail] = useState(DEMO_ADMIN_EMAIL);
	const [password, setPassword] = useState(DEMO_PASSWORD);
	const [name, setName] = useState("");
	const [joinEmail, setJoinEmail] = useState("");
	const [joinPassword, setJoinPassword] = useState("");
	const [inviteCode, setInviteCode] = useState("ESTANCIA");
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
				email_taken: "That email is already registered.",
				password_too_short: "Password must be at least 8 characters.",
				missing_fields: "Please fill in every field.",
			};
			return setError(messages[data.error ?? ""] ?? "Registration failed.");
		}
		window.location.href = "/app";
	}

	return (
		<div className="mx-auto max-w-md px-4 py-16">
			<div className="mb-4 text-center text-3xl">🏐</div>
			<div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
				<h1 className="mb-1 text-2xl font-extrabold">
					Estancia<span className="text-brand">VB</span>
				</h1>
				<p className="mb-5 text-sm text-muted">Community volleyball league — poll, teams, auction, schedule & live scores.</p>

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
						<p className="text-xs text-muted">
							Demo super admin: <span className="mono">{DEMO_ADMIN_EMAIL}</span> / <span className="mono">{DEMO_PASSWORD}</span>
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
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
					</div>
				)}
			</div>
			<p className="mt-4 text-center text-xs text-muted">Estancia Recreation Club · Summer Volleyball League 2026</p>
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
