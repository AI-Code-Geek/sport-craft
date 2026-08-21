"use client";

/** Small shared presentational pieces used across every page. */
import Link from "next/link";
import { useParams } from "next/navigation";
import type { TournamentStatus } from "@/lib/types";

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
	return (
		<div className={`rounded-2xl border border-border bg-surface ${className}`}>
			{title ? (
				<div className="border-b border-border px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">{title}</div>
			) : null}
			<div className="p-4">{children}</div>
		</div>
	);
}

const STATUS_CLASSES: Record<string, string> = {
	confirmed: "bg-ok/15 text-ok", completed: "bg-ok/15 text-ok", active: "bg-ok/15 text-ok", won: "bg-ok/15 text-ok",
	waitlisted: "bg-warn/15 text-warn", scheduled: "bg-warn/15 text-warn", pending: "bg-warn/15 text-warn",
	live: "bg-bad/15 text-bad", cancelled: "bg-neutral/20 text-neutral", lost: "bg-neutral/20 text-neutral", withdrawn: "bg-neutral/20 text-neutral",
};
export function StatusBadge({ status }: { status: string }) {
	const cls = STATUS_CLASSES[status] ?? "bg-neutral/20 text-neutral";
	return (
		<span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tracking-wide uppercase ${cls}`}>
			{status === "live" ? <span className="h-1.5 w-1.5 rounded-full bg-bad live-pulse" /> : null}
			{status.replace(/_/g, " ")}
		</span>
	);
}

const TEAM_DOT: Record<number, string> = { 1: "bg-t1", 2: "bg-t2", 3: "bg-t3", 4: "bg-t4", 5: "bg-t5", 6: "bg-t6", 7: "bg-t7", 8: "bg-t8" };
export function TeamChip({ id, name, color, link = true }: { id: string; name: string; color: number; link?: boolean }) {
	const params = useParams<{ org?: string }>();
	const inner = (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-sm font-medium">
			<span className={`h-2.5 w-2.5 rounded-full ${TEAM_DOT[color] ?? "bg-neutral"}`} />
			{name}
		</span>
	);
	return link && params.org ? <Link href={`/app/${params.org}/teams#${id}`}>{inner}</Link> : inner;
}

export function Meter({ pct, thin = false }: { pct: number; thin?: boolean }) {
	const clamped = Math.max(0, Math.min(100, pct));
	return (
		<div className={`overflow-hidden rounded-full bg-surface-2 ${thin ? "h-1.5" : "h-2"}`}>
			<div className="h-full rounded-full bg-brand" style={{ width: `${clamped}%` }} />
		</div>
	);
}

const STAGES: { key: TournamentStatus[]; label: string; sub: string }[] = [
	{ key: ["draft", "poll_open"], label: "Poll", sub: "Signup & confirm" },
	{ key: ["poll_closed"], label: "Captains", sub: "Pick & name teams" },
	{ key: ["captains_selected"], label: "Positions", sub: "Categorize players" },
	{ key: ["positions_set", "auction_live"], label: "Auction", sub: "Bid for rosters" },
	{ key: ["auction_complete"], label: "Schedule", sub: "Publish matches" },
	{ key: ["schedule_published", "in_progress"], label: "Group stage", sub: "Play & score" },
	{ key: ["playoffs", "completed"], label: "Playoffs", sub: "Bracket" },
];
export function LifecycleStepper({ status }: { status: TournamentStatus }) {
	const currentIdx = STAGES.findIndex((s) => s.key.includes(status));
	return (
		<div className="flex flex-wrap gap-2">
			{STAGES.map((s, i) => {
				const done = i < currentIdx;
				const current = i === currentIdx;
				return (
					<div
						key={s.label}
						className={`min-w-[130px] flex-1 rounded-xl border px-3 py-2.5 text-sm ${
							done ? "border-ok/40 bg-ok/8" : current ? "border-brand bg-brand/8 ring-2 ring-brand/15" : "border-border bg-surface-2"
						}`}
					>
						<div className="font-semibold">
							{done ? <span className="text-ok">✓ </span> : current ? <span className="text-brand">▶ </span> : null}
							{s.label}
						</div>
						<div className="text-xs text-muted">{s.sub}</div>
					</div>
				);
			})}
		</div>
	);
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
	return (
		<div className="rounded-xl border border-border bg-surface p-4 text-center">
			<div className="text-2xl font-extrabold">{value}</div>
			<div className="text-xs text-muted">{label}</div>
		</div>
	);
}

export function EmptyState({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: React.ReactNode }) {
	return (
		<Card>
			<div className="flex flex-col items-center gap-2 py-10 text-center">
				<div className="text-3xl">{icon}</div>
				<div className="font-medium">{title}</div>
				<div className="max-w-sm text-sm text-muted">{sub}</div>
				{action}
			</div>
		</Card>
	);
}
