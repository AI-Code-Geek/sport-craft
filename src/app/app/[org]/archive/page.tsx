"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { listTournaments } from "@/lib/api-client";
import { Card, EmptyState } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Tournament } from "@/lib/types";

export default function ArchivePage() {
	const { org } = useParams<{ org: string }>();
	const [tournaments, setTournaments] = useState<Tournament[] | null>(null);

	useEffect(() => {
		listTournaments().then(({ data }) => {
			const completed = (data.tournaments ?? []).filter((t) => t.status === "completed");
			completed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
			setTournaments(completed);
		});
	}, []);

	if (tournaments === null) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

	if (tournaments.length === 0) {
		return (
			<EmptyState
				icon="🗄️"
				title="No past tournaments yet"
				sub="Once a tournament's playoffs finish, it lands here — final standings, bracket, and winner, kept for reference."
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-xl font-bold">Tournament archive</h1>
			<div className="flex flex-col gap-3">
				{tournaments.map((t) => (
					<Link key={t.id} href={`/app/${org}/archive/${t.id}`}>
						<Card className="hover:bg-surface-2">
							<div className="flex items-center justify-between">
								<div>
									<div className="font-semibold">{t.name}</div>
									<div className="text-xs text-muted">
										{t.pollOpenedAt ? `Started ${fmtDateTime(t.pollOpenedAt)}` : "—"}
									</div>
								</div>
								<span className="rounded-md bg-ok/15 px-2 py-1 text-xs font-bold text-ok uppercase">Completed</span>
							</div>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
