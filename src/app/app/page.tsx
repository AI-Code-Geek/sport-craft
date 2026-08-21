"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/api-client";
import type { MembershipView } from "@/lib/api-client";
import { Card } from "@/components/ui";

type Phase = "loading" | "pending" | "no-org";

/** Bare /app — redirects into /app/<active org's slug> as soon as there is one. Otherwise shows the
 *  "awaiting approval" / "no org yet" states, which (unlike the org dashboard) don't need a URL slug. */
export default function AppRootPage() {
	const router = useRouter();
	const [phase, setPhase] = useState<Phase>("loading");
	const [pendingOrgs, setPendingOrgs] = useState<MembershipView[]>([]);

	useEffect(() => {
		fetchMe().then(({ data }) => {
			if (!data.user) return;
			if (data.communitySlug) {
				router.replace(`/app/${data.communitySlug}`);
				return;
			}
			if (data.isSuperAdmin) {
				router.replace("/app/admin/organizations");
				return;
			}
			const pending = (data.memberships ?? []).filter((m) => m.status === "pending");
			setPendingOrgs(pending);
			setPhase(pending.length > 0 ? "pending" : "no-org");
		});
	}, [router]);

	if (phase === "pending") {
		return (
			<Card title="Awaiting approval">
				<div className="flex flex-col gap-2">
					{pendingOrgs.map((m) => (
						<p key={m.communityId} className="text-sm">
							Your request to join <strong>{m.communityName}</strong> is awaiting approval from that org&apos;s Org Admin.
						</p>
					))}
				</div>
			</Card>
		);
	}

	if (phase === "no-org") {
		return (
			<Card>
				<p className="text-sm text-muted">You&apos;re not a member of any organization yet — join one with an invite code from the login page.</p>
			</Card>
		);
	}

	return (
		<Card>
			<p className="text-sm text-muted">Loading…</p>
		</Card>
	);
}
