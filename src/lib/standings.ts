/**
 * Standings — a PURE function computed from matches + teams on every read, never persisted (avoids a
 * derived-cache drift risk). Tie-break order (docs/DEVPLAN.md §2): league points → set ratio →
 * head-to-head → point differential.
 */
import type { Match, StandingsRow, Team } from "./types";

export function computeStandings(teams: Team[], matches: Match[], winPoints = 2): StandingsRow[] {
	const rows = new Map<string, StandingsRow>();
	for (const t of teams) {
		rows.set(t.id, {
			teamId: t.id, played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0,
			pointsFor: 0, pointsAgainst: 0, leaguePoints: 0, rank: 0,
		});
	}

	const completed = matches.filter((m) => m.round === "group" && m.status === "completed");
	const h2h = new Map<string, Map<string, number>>(); // winnerId -> loserId -> wins

	for (const m of completed) {
		const a = rows.get(m.teamAId);
		const b = rows.get(m.teamBId);
		if (!a || !b) continue;
		const setsA = m.sets.filter((s) => s.status === "completed" && s.a > s.b).length;
		const setsB = m.sets.filter((s) => s.status === "completed" && s.b > s.a).length;
		const ptsA = m.sets.reduce((sum, s) => sum + s.a, 0);
		const ptsB = m.sets.reduce((sum, s) => sum + s.b, 0);

		a.played++; b.played++;
		a.setsWon += setsA; a.setsLost += setsB;
		b.setsWon += setsB; b.setsLost += setsA;
		a.pointsFor += ptsA; a.pointsAgainst += ptsB;
		b.pointsFor += ptsB; b.pointsAgainst += ptsA;

		if (m.winnerTeamId === m.teamAId) {
			a.won++; b.lost++; a.leaguePoints += winPoints;
		} else if (m.winnerTeamId === m.teamBId) {
			b.won++; a.lost++; b.leaguePoints += winPoints;
		}
		if (m.winnerTeamId) {
			const loser = m.winnerTeamId === m.teamAId ? m.teamBId : m.teamAId;
			if (!h2h.has(m.winnerTeamId)) h2h.set(m.winnerTeamId, new Map());
			const inner = h2h.get(m.winnerTeamId)!;
			inner.set(loser, (inner.get(loser) ?? 0) + 1);
		}
	}

	const setRatio = (r: StandingsRow) => (r.setsLost === 0 ? r.setsWon * 1000 : r.setsWon / r.setsLost);

	const list = [...rows.values()].sort((x, y) => {
		if (y.leaguePoints !== x.leaguePoints) return y.leaguePoints - x.leaguePoints;
		const ry = setRatio(y), rx = setRatio(x);
		if (ry !== rx) return ry - rx;
		const xWinsY = h2h.get(x.teamId)?.get(y.teamId) ?? 0;
		const yWinsX = h2h.get(y.teamId)?.get(x.teamId) ?? 0;
		if (yWinsX !== xWinsY) return yWinsX - xWinsY;
		return (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst);
	});
	list.forEach((row, i) => (row.rank = i + 1));
	return list;
}
