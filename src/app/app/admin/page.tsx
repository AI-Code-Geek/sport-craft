"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Bare /app/admin has no page of its own — this only exists so it doesn't fall through to the
 *  [org] dynamic segment (which would treat "admin" as an org slug — reserved, see src/lib/ids.ts). */
export default function AdminRootPage() {
	const router = useRouter();
	useEffect(() => {
		router.replace("/app/admin/organizations");
	}, [router]);
	return null;
}
