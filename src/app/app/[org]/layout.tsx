"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchMe, switchOrgBySlug } from "@/lib/api-client";
import { Card } from "@/components/ui";

/**
 * Keeps the session's active org in sync with the `[org]` slug in the URL — the session cookie is
 * still the authoritative source for auth (see docs/developer/03-auth-and-roles.md), this layout just
 * makes the URL a real, bookmarkable/shareable pointer into a specific org rather than a hidden
 * cookie-only concept. If the slug doesn't match the session's current active org, this switches into
 * it (an active membership, or any org at all if you're a platform Super Admin — see
 * /api/me/switch-org) before rendering any page underneath. If that's not possible (unknown slug, or a
 * regular account with no access there), it bounces back to /app, which redirects to wherever they
 * actually belong.
 */
export default function OrgLayout({ children }: { children: React.ReactNode }) {
	const { org } = useParams<{ org: string }>();
	const router = useRouter();
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setReady(false);
		(async () => {
			const { data } = await fetchMe();
			if (!data.user) {
				router.replace("/");
				return;
			}
			if (data.communitySlug === org) {
				if (!cancelled) setReady(true);
				return;
			}
			const { ok } = await switchOrgBySlug(org);
			if (cancelled) return;
			if (!ok) {
				router.replace("/app");
				return;
			}
			setReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [org, router]);

	if (!ready) {
		return (
			<Card>
				<p className="text-sm text-muted">Loading…</p>
			</Card>
		);
	}
	return <>{children}</>;
}
