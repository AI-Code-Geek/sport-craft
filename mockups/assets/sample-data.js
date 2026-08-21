/* Mock dataset for the Estancia Volleyball League static mockups.
   Shape mirrors docs/DEVPLAN.md §2. Real app: this all lives in D1; here it's just an in-browser
   constant so every mockup page can render realistic, internally-consistent data with no server. */
(function () {
  const FIRST = ["Meera","David","Priya","Alex","Jordan","Sam","Taylor","Riley","Chris","Morgan",
    "Jamie","Casey","Devon","Avery","Reese","Cameron","Drew","Skylar","Rowan","Hayden"];
  const LAST = ["Iyer","Kim","Nair","Santos","Reyes","Patel","Okafor","Fischer","Costa","Nguyen",
    "Bianchi","Haddad","Wallace","Torres","Meyer","Alvarez","Kowalski","Duarte","Hollis","Petrov"];
  function genName(i) { return FIRST[i % FIRST.length] + " " + LAST[(i * 7 + 3) % LAST.length]; }
  function genEmail(name, i) { return name.toLowerCase().replace(/[^a-z]+/g, ".") + i + "@estancia.mail"; }

  // ---- community + tournament ----
  const community = { id: "c_estancia", name: "Estancia Recreation Club", slug: "estancia", inviteCode: "ESTANCIA-2026" };

  const tournament = {
    id: "t_2026summer", community_id: "c_estancia", name: "Estancia Summer Volleyball League 2026",
    status: "in_progress", // draft|poll_open|poll_closed|captains_selected|auction_live|auction_complete|schedule_published|in_progress|playoffs|completed
    max_teams: 6, team_size: 6, budget_points: 100,
    poll_capacity: 36, sets_to_win: 2, points_per_set: 25, win_by: 2, playoff_team_count: 4,
    poll_opened_at: "2026-06-01T09:00:00", poll_closed_at: "2026-06-14T23:59:00",
  };

  // ---- admin / organizers (not part of the player poll) ----
  const staff = [
    { id: "u_admin", name: "Meera Iyer", email: "meera.success@gmail.com", role: "admin" },
    { id: "u_org1", name: "David Kim", email: "david.kim@estancia.mail", role: "organizer" },
    { id: "u_org2", name: "Priya Nair", email: "priya.nair@estancia.mail", role: "organizer" },
  ];

  // ---- 42 poll voters: 0-35 confirmed (capacity 36), 36-41 waitlisted ----
  const voters = [];
  for (let i = 0; i < 42; i++) {
    const name = genName(i);
    voters.push({ id: "u" + (i + 1), name, email: genEmail(name, i + 1), role: "player" });
  }
  const users = staff.concat(voters);

  const pollStart = new Date("2026-06-01T09:00:00").getTime();
  const entries = voters.map((u, i) => ({
    user_id: u.id,
    status: i < 36 ? "confirmed" : "waitlisted",
    submitted_at: new Date(pollStart + i * 11 * 60000).toISOString(), // ~11 min apart
  }));
  const poll = { capacity: tournament.poll_capacity, opened_at: tournament.poll_opened_at, entries };

  // ---- positions: the organizing committee buckets the 30 non-captain confirmed players into
  //      one skill category per remaining roster slot (team_size 6 - 1 captain = 5 categories),
  //      BEFORE the auction opens. Each category holds exactly `max_teams` (6) players, so every
  //      team wins exactly one per category and every player in the pool gets bought. ----
  const POSITIONS = ["Setter", "Spiker 1", "Spiker 2", "Back Player 1", "Back Player 2"];

  // ---- teams: captains at confirmed-pool indices 0,7,14,21,28,35 ----
  // roster[j] / prices[j] line up with POSITIONS[j] (column j across every team = that position's pool).
  const TEAM_META = [
    { name: "Estancia Smashers", colorClass: 1, captainIdx: 0, roster: [1, 2, 3, 4, 5], prices: [28, 24, 19, 15, 12] },
    { name: "Net Ninjas", colorClass: 2, captainIdx: 7, roster: [6, 8, 9, 10, 11], prices: [30, 22, 18, 14, 10] },
    { name: "Sunset Spikers", colorClass: 3, captainIdx: 14, roster: [12, 13, 15, 16, 17], prices: [26, 21, 20, 16, 11] },
    { name: "Block Party", colorClass: 4, captainIdx: 21, roster: [18, 19, 20, 22, 23], prices: [25, 23, 17, 13, 9] },
    { name: "Ace Avengers", colorClass: 5, captainIdx: 28, roster: [24, 25, 26, 27, 29], prices: [32, 20, 19, 15, 8] },
    { name: "Rally Rebels", colorClass: 6, captainIdx: 35, roster: [30, 31, 32, 33, 34], prices: [27, 22, 18, 16, 13] },
  ];
  const teams = TEAM_META.map((m, i) => {
    const spent = m.prices.reduce((a, b) => a + b, 0);
    return {
      id: "team" + (i + 1), name: m.name, color: m.colorClass,
      captain_user_id: voters[m.captainIdx].id,
      budget_total: tournament.budget_points, budget_remaining: tournament.budget_points - spent,
      roster: [
        { user_id: voters[m.captainIdx].id, role: "captain", position: "Captain", sold_price: null },
        ...m.roster.map((idx, j) => ({ user_id: voters[idx].id, role: "bid", position: POSITIONS[j], sold_price: m.prices[j] })),
      ],
    };
  });
  // position pool as assigned by the committee pre-auction (6 players per position, one per team's eventual pick)
  const positionPool = {};
  POSITIONS.forEach((pos, j) => {
    positionPool[pos] = TEAM_META.map(m => ({ user_id: voters[m.roster[j]].id }));
  });
  function userName(id) { const u = users.find(x => x.id === id); return u ? u.name : id; }
  function teamName(id) { const t = teams.find(x => x.id === id); return t ? t.name : id; }
  function teamById(id) { return teams.find(x => x.id === id); }

  // ---- a "position-round auction in progress" snapshot — paused mid-way through the SAME auction
  //      that produced the final `teams` rosters above (Setter + Spiker 1 rounds are done; Spiker 2
  //      round is live), so sold prices here match the final data exactly. Used by auction.html /
  //      admin-auction.html / admin-positions.html to demo the live position-by-position bidding UI. ----
  const auctionLive = {
    status: "live", // not_started|live|paused|complete
    budget_points: 100,
    positions: POSITIONS,
    roundsCompleted: ["Setter", "Spiker 1"],
    currentRound: "Spiker 2",
    roundsRemaining: ["Back Player 1", "Back Player 2"],
    // per-team: positions filled so far (out of 5) and remaining budget at THIS moment
    teamState: [
      { team_id: "team1", filled: 3, budget_remaining: 29 },
      { team_id: "team2", filled: 2, budget_remaining: 48 },
      { team_id: "team3", filled: 3, budget_remaining: 33 },
      { team_id: "team4", filled: 2, budget_remaining: 52 },
      { team_id: "team5", filled: 2, budget_remaining: 48 },
      { team_id: "team6", filled: 3, budget_remaining: 33 },
    ],
    // currently open bid: team4 is bidding for its Spiker 2 slot, will close at $17 (matches final roster)
    currentNominee: { user_id: "u21", position: "Spiker 2" },
    currentBid: { amount: 15, team_id: "team4" },
    turn_deadline_in_s: 9,
    // remaining Spiker 2 nominees still needed by teams that haven't won this round yet
    nominationQueue: [
      { user_id: "u10", position: "Spiker 2" },
      { user_id: "u27", position: "Spiker 2" },
    ],
    log: [
      { user_id: "u32", team_id: "team6", position: "Spiker 1", amount: 22, result: "sold" },
      { user_id: "u26", team_id: "team5", position: "Spiker 1", amount: 20, result: "sold" },
      { user_id: "u33", team_id: "team6", position: "Spiker 2", amount: 18, result: "sold" },
      { user_id: "u16", team_id: "team3", position: "Spiker 2", amount: 20, result: "sold" },
      { user_id: "u4", team_id: "team1", position: "Spiker 2", amount: 19, result: "sold" },
      { user_id: "u21", team_id: "team4", position: "Spiker 2", amount: 15, result: "bidding" },
    ],
  };

  // ---- schedule: single round robin, 6 teams = 15 matches ----
  const VENUE = "Estancia Community Gym";
  function sets(list) { return list.map((s, i) => ({ set_number: i + 1, a: s[0], b: s[1], status: "completed" })); }
  const rawMatches = [
    { a: 1, b: 2, when: "2026-07-05T18:00:00", court: "Court A", status: "completed", sets: [[25,18],[25,20]] },
    { a: 3, b: 4, when: "2026-07-05T19:15:00", court: "Court B", status: "completed", sets: [[25,22],[20,25],[15,11]] },
    { a: 5, b: 6, when: "2026-07-08T18:00:00", court: "Court A", status: "completed", sets: [[25,15],[25,19]] },
    { a: 1, b: 3, when: "2026-07-08T19:15:00", court: "Court B", status: "completed", sets: [[22,25],[25,20],[15,12]] },
    { a: 2, b: 5, when: "2026-07-12T18:00:00", court: "Court A", status: "completed", sets: [[17,25],[21,25]] },
    { a: 4, b: 6, when: "2026-07-12T19:15:00", court: "Court B", status: "completed", sets: [[18,25],[25,23],[15,9]] },
    { a: 1, b: 5, when: "2026-07-15T18:00:00", court: "Court A", status: "completed", sets: [[25,19],[25,16]] },
    { a: 2, b: 4, when: "2026-07-15T19:15:00", court: "Court B", status: "completed", sets: [[25,20],[19,25],[15,13]] },
    { a: 3, b: 6, when: "2026-07-19T18:00:00", court: "Court A", status: "completed", sets: [[25,14],[25,18]] },
    { a: 2, b: 3, when: "2026-08-18T19:00:00", court: "Court A", status: "live",
      sets: [[25,21]], liveSet: { set_number: 2, a: 14, b: 11 } },
    { a: 1, b: 4, when: "2026-08-19T18:00:00", court: "Court A", status: "scheduled" },
    { a: 1, b: 6, when: "2026-08-19T19:15:00", court: "Court B", status: "scheduled" },
    { a: 2, b: 6, when: "2026-08-22T18:00:00", court: "Court A", status: "scheduled" },
    { a: 3, b: 5, when: "2026-08-22T19:15:00", court: "Court B", status: "scheduled" },
    { a: 4, b: 5, when: "2026-08-26T18:00:00", court: "Court A", status: "scheduled" },
  ];
  const matches = rawMatches.map((m, i) => {
    const team_a_id = "team" + m.a, team_b_id = "team" + m.b;
    let setRows = m.sets ? sets(m.sets) : [];
    let winner_team_id = null;
    if (m.status === "completed") {
      const aWins = setRows.filter(s => s.a > s.b).length, bWins = setRows.length - aWins;
      winner_team_id = aWins > bWins ? team_a_id : team_b_id;
    }
    if (m.status === "live" && m.liveSet) setRows = setRows.concat([{ ...m.liveSet, status: "in_progress" }]);
    return {
      id: "m" + (i + 1), tournament_id: tournament.id, round: "group",
      team_a_id, team_b_id, scheduled_at: m.when, venue: VENUE, court: m.court,
      status: m.status, sets: setRows, winner_team_id,
    };
  });

  // ---- standings (hand-verified from the completed matches above) ----
  const standings = [
    { team_id: "team1", played: 3, won: 3, lost: 0, sets_won: 6, sets_lost: 1, points_for: 162, points_against: 130, league_points: 6, rank: 1 },
    { team_id: "team5", played: 3, won: 2, lost: 1, sets_won: 4, sets_lost: 2, points_for: 135, points_against: 122, league_points: 4, rank: 2 },
    { team_id: "team3", played: 3, won: 2, lost: 1, sets_won: 5, sets_lost: 3, points_for: 167, points_against: 152, league_points: 4, rank: 3 },
    { team_id: "team4", played: 3, won: 1, lost: 2, sets_won: 4, sets_lost: 5, points_for: 174, points_against: 176, league_points: 2, rank: 4 },
    { team_id: "team2", played: 3, won: 1, lost: 2, sets_won: 2, sets_lost: 5, points_for: 135, points_against: 158, league_points: 2, rank: 5 },
    { team_id: "team6", played: 3, won: 0, lost: 3, sets_won: 1, sets_lost: 6, points_for: 123, points_against: 158, league_points: 0, rank: 6 },
  ];

  // ---- playoff bracket (provisional preview seeded from current standings; group stage not finished) ----
  const bracket = {
    playoff_team_count: 4, provisional: true,
    rounds: [
      { name: "Semifinal", matches: [
        { seed_a: 1, seed_b: 4, team_a_id: "team1", team_b_id: "team4", status: "scheduled", scheduled_at: "2026-09-02T18:00:00" },
        { seed_a: 2, seed_b: 3, team_a_id: "team5", team_b_id: "team3", status: "scheduled", scheduled_at: "2026-09-02T19:15:00" },
      ]},
      { name: "Final", matches: [
        { seed_a: null, seed_b: null, team_a_id: null, team_b_id: null, status: "pending", scheduled_at: "2026-09-06T18:30:00" },
      ]},
    ],
  };

  window.SAMPLE = { community, tournament, users, poll, teams, positions: POSITIONS, positionPool,
    auctionLive, matches, standings, bracket, helpers: { userName, teamName, teamById } };
})();
