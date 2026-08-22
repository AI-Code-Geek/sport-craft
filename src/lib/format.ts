/** Client-safe formatters shared across pages. */

export function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function fmtTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
export function fmtDateTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function initials(name: string): string {
	return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

/** tournament.status alone can't distinguish "poll frozen" from "poll open" — frozen lives only on the Poll record. */
export function tournamentStatusLabel(status: string, pollFrozen: boolean): string {
	if (status === "poll_open" && pollFrozen) return "poll frozen";
	return status.replace(/_/g, " ");
}
