/**
 * Poll (season signup) — KV key `poll:<tournamentId>` -> Poll (single blob: capacity + entries[]).
 * Confirmation rule (docs/DEVPLAN.md §2): first `capacity` CONFIRMED entries by `submittedAt` win;
 * everyone after that waitlists. Withdrawing a confirmed entry promotes the oldest waitlisted entry
 * (FIFO). Small lists (tens of entries) — safe to rewrite the whole blob per mutation.
 */
import { kvGetJSON, kvPutJSON } from "./kv";
import { getTournament, putTournament } from "./tournament-store";
import type { Poll, PollEntry } from "./types";

const key = (tournamentId: string) => `poll:${tournamentId}`;

export async function getPoll(tournamentId: string): Promise<Poll | null> {
	return kvGetJSON<Poll>(key(tournamentId));
}

export async function openPoll(tournamentId: string): Promise<Poll> {
	const t = await getTournament(tournamentId);
	if (!t) throw new Error("tournament_not_found");
	let poll = await getPoll(tournamentId);
	if (!poll) {
		poll = { tournamentId, capacity: t.pollCapacity, openedAt: new Date().toISOString(), closedAt: null, frozen: false, entries: [] };
	} else {
		poll.frozen = false;
		poll.closedAt = null;
		if (!poll.openedAt) poll.openedAt = new Date().toISOString();
	}
	await kvPutJSON(key(tournamentId), poll);
	t.status = "poll_open";
	t.pollOpenedAt = poll.openedAt;
	await putTournament(t);
	return poll;
}

export async function freezePoll(tournamentId: string): Promise<Poll | null> {
	const poll = await getPoll(tournamentId);
	if (!poll) return null;
	poll.frozen = true;
	await kvPutJSON(key(tournamentId), poll);
	return poll;
}

export async function closePoll(tournamentId: string): Promise<Poll | null> {
	const poll = await getPoll(tournamentId);
	if (!poll) return null;
	poll.frozen = true;
	poll.closedAt = new Date().toISOString();
	await kvPutJSON(key(tournamentId), poll);
	const t = await getTournament(tournamentId);
	if (t) {
		t.status = "poll_closed";
		t.pollClosedAt = poll.closedAt;
		await putTournament(t);
	}
	return poll;
}

function confirmedCount(poll: Poll): number {
	return poll.entries.filter((e) => e.status === "confirmed").length;
}

export type JoinResult = { poll: Poll; status: PollEntry["status"] };

/** Join (or re-join after withdrawing) the poll. Confirms if under capacity, else waitlists. */
export async function joinPoll(tournamentId: string, userId: string): Promise<JoinResult> {
	const poll = await getPoll(tournamentId);
	if (!poll) throw new Error("poll_not_open");
	if (poll.frozen) throw new Error("poll_frozen");

	const existing = poll.entries.find((e) => e.userId === userId);
	if (existing && existing.status !== "withdrawn") return { poll, status: existing.status };

	const status: PollEntry["status"] = confirmedCount(poll) < poll.capacity ? "confirmed" : "waitlisted";
	const entry: PollEntry = { userId, status, submittedAt: new Date().toISOString() };
	if (existing) {
		existing.status = entry.status;
		existing.submittedAt = entry.submittedAt;
	} else {
		poll.entries.push(entry);
	}
	await kvPutJSON(key(tournamentId), poll);
	return { poll, status };
}

/** Withdraw a confirmed/waitlisted entry; if it was confirmed, promote the oldest waitlisted entry. */
export async function withdrawFromPoll(tournamentId: string, userId: string): Promise<Poll> {
	const poll = await getPoll(tournamentId);
	if (!poll) throw new Error("poll_not_open");
	const entry = poll.entries.find((e) => e.userId === userId);
	if (!entry || entry.status === "withdrawn") return poll;
	const wasConfirmed = entry.status === "confirmed";
	entry.status = "withdrawn";
	if (wasConfirmed) promoteNextWaitlisted(poll);
	await kvPutJSON(key(tournamentId), poll);
	return poll;
}

/** Admin: remove a confirmed player's spot (same as withdraw, from the admin side). */
export async function removeConfirmedEntry(tournamentId: string, userId: string): Promise<Poll> {
	return withdrawFromPoll(tournamentId, userId);
}

/** Admin: manually promote a specific waitlisted entry to confirmed (bypasses FIFO order). */
export async function promoteEntry(tournamentId: string, userId: string): Promise<Poll> {
	const poll = await getPoll(tournamentId);
	if (!poll) throw new Error("poll_not_open");
	const entry = poll.entries.find((e) => e.userId === userId);
	if (entry && entry.status === "waitlisted") entry.status = "confirmed";
	await kvPutJSON(key(tournamentId), poll);
	return poll;
}

function promoteNextWaitlisted(poll: Poll): void {
	const next = poll.entries
		.filter((e) => e.status === "waitlisted")
		.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))[0];
	if (next) next.status = "confirmed";
}
