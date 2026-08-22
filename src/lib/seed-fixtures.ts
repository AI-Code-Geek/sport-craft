/** Pure helpers for fabricating plausible match results — shared by every seed script (never used at runtime outside dev seeding). */
import type { Match, SetScore } from "./types";

export function randomSet(setNumber: number, pointsPerSet: number, winBy: number): SetScore {
	const aWins = Math.random() < 0.5;
	const margin = winBy + Math.floor(Math.random() * 10);
	let a: number, b: number;
	if (aWins) {
		a = pointsPerSet;
		b = Math.max(0, pointsPerSet - margin);
	} else {
		b = pointsPerSet;
		a = Math.max(0, pointsPerSet - margin);
	}
	return { setNumber, a, b, status: "completed" };
}

/** Shuffled sequence of `aPoints` "a" outcomes and `bPoints` "b" outcomes — a plausible point-by-point order for feeding through the real `addPoint` API instead of hand-writing a final score. */
export function interleavedPointSequence(aPoints: number, bPoints: number): ("a" | "b")[] {
	const seq: ("a" | "b")[] = [...Array(aPoints).fill("a" as const), ...Array(bPoints).fill("b" as const)];
	for (let i = seq.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[seq[i], seq[j]] = [seq[j], seq[i]];
	}
	return seq;
}

export function simulateCompletedMatch(match: Match, setsToWin: number, pointsPerSet: number, winBy: number): void {
	const sets: SetScore[] = [];
	let setsA = 0, setsB = 0, n = 1;
	while (Math.max(setsA, setsB) < setsToWin) {
		const s = randomSet(n, pointsPerSet, winBy);
		sets.push(s);
		if (s.a > s.b) setsA++; else setsB++;
		n++;
	}
	match.sets = sets;
	match.status = "completed";
	match.winnerTeamId = setsA > setsB ? match.teamAId : match.teamBId;
}
