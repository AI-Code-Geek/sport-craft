/* Shared helpers for the Estancia Volleyball League static mockups.
   Data source: window.SAMPLE (assets/sample-data.js). No server — role/session is a demo switcher
   stored in localStorage so every page can be previewed as any persona without a real login. */
(function () {
  const S = window.SAMPLE || {};
  const VB = (window.VB = {});
  VB.S = S;
  const H = S.helpers || {};
  VB.userName = H.userName || (id => id);
  VB.teamName = H.teamName || (id => id);
  VB.teamById = H.teamById || (id => null);

  // ---- demo identity / role switcher (real app: signed session cookie + tournament_organizers/teams lookup) ----
  const ROLES = ["super_admin", "organizer", "captain", "player"];
  VB.roles = ROLES;
  const ROLE_LABEL = { super_admin: "Super Admin", organizer: "Organizer", captain: "Captain", player: "Player" };
  VB.roleLabel = (r) => ROLE_LABEL[r] || r;

  VB.role = () => localStorage.getItem("vb_role") || "player";
  VB.setRole = (r) => { localStorage.setItem("vb_role", r); location.reload(); };
  VB.requireSession = () => {}; // mockup: all screens are viewable; real app gates /app/** on a session cookie

  // "who am I" per demo role — real app: users row from the session; captain/organizer are derived per-tournament
  VB.currentUser = () => {
    const r = VB.role();
    if (r === "super_admin") return S.users.find(u => u.id === "u_admin");
    if (r === "organizer") return S.users.find(u => u.id === "u_org1");
    if (r === "captain") return S.users.find(u => u.id === S.teams[0].captain_user_id);
    return S.users.find(u => u.id === "u10"); // demo confirmed player, not a captain
  };
  VB.myTeam = () => {
    const me = VB.currentUser();
    return S.teams.find(t => t.roster.some(r => r.user_id === me.id)) || null;
  };
  VB.isCaptainOfTeam = (teamId) => VB.role() === "captain" && VB.myTeam() && VB.myTeam().id === teamId;
  VB.isOrganizerPlus = () => VB.role() === "organizer" || VB.role() === "super_admin";
  VB.isSuperAdmin = () => VB.role() === "super_admin";

  // ---- formatters ----
  const f = VB.fmt = {
    date: (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }),
    time: (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    datetime: (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    pts: (n) => n == null ? "—" : n + " pt" + (n === 1 ? "" : "s"),
    initials: (name) => (name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase(),
  };

  // ---- render helpers ----
  VB.roleBadge = (r) => `<span class="badge-role role-${r}">${VB.roleLabel(r)}</span>`;
  VB.statusBadge = (s) => `<span class="badge-status st-${s}">${(s || "").replace(/_/g, " ")}</span>`;
  VB.teamChip = (teamId, opts) => {
    const t = VB.teamById(teamId);
    if (!t) return `<span class="team-chip muted">TBD</span>`;
    const link = opts && opts.link !== false;
    const inner = `<span class="team-dot dot-${t.color}"></span>${t.name}`;
    return link ? `<a class="team-chip clickable" href="teams.html#${t.id}">${inner}</a>` : `<span class="team-chip">${inner}</span>`;
  };
  VB.meter = (pct, thin) => `<div class="meter${thin ? " meter-thin" : ""}"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>`;

  VB.matchScoreLabel = (m) => {
    if (!m.sets || !m.sets.length) return "—";
    const aWins = m.sets.filter(s => s.status === "completed" && s.a > s.b).length;
    const bWins = m.sets.filter(s => s.status === "completed" && s.b > s.a).length;
    return `${aWins}–${bWins}`;
  };

  // ---- lifecycle stepper (shared by home.html + admin-home.html) ----
  const STAGES = [
    { key: "poll", label: "Poll", sub: "Signup & confirm" },
    { key: "captains", label: "Captains", sub: "Pick & name teams" },
    { key: "positions", label: "Positions", sub: "Categorize players" },
    { key: "auction", label: "Auction", sub: "Bid for rosters" },
    { key: "schedule", label: "Schedule", sub: "Publish matches" },
    { key: "group", label: "Group stage", sub: "Play & score" },
    { key: "playoffs", label: "Playoffs", sub: "Bracket" },
  ];
  // status -> index of the CURRENT stage (0-based into STAGES)
  const STATUS_STAGE = {
    draft: 0, poll_open: 0, poll_closed: 1, captains_selected: 2, positions_set: 3,
    auction_live: 3, auction_complete: 4, schedule_published: 5, in_progress: 5,
    playoffs: 6, completed: 6,
  };
  VB.lifecycleStepper = () => {
    const cur = STATUS_STAGE[S.tournament.status] ?? 0;
    return `<div class="stepper">` + STAGES.map((s, i) => {
      const cls = i < cur ? "done" : i === cur ? "current" : "";
      return `<div class="step ${cls}"><span class="step-label">${s.label}</span><span class="step-sub">${s.sub}</span></div>`;
    }).join("") + `</div>`;
  };

  // ---- nav ----
  VB.renderNav = (active) => {
    const role = VB.role();
    const me = VB.currentUser();
    const participantLinks = [
      ["home.html", "home", "Home"],
      ["poll.html", "poll", "Poll"],
      ["teams.html", "teams", "Teams"],
      ["my-team.html", "myteam", "My Team"],
      ["auction.html", "auction", "Auction"],
      ["schedule.html", "schedule", "Schedule"],
      ["standings.html", "standings", "Standings"],
      ["bracket.html", "bracket", "Bracket"],
    ];
    const item = (href, key, label) =>
      `<li class="nav-item"><a class="nav-link ${active === key ? "active" : ""}" href="${href}">${label}</a></li>`;

    const adminLinks = [];
    if (VB.isSuperAdmin()) {
      adminLinks.push(["admin-tournaments-new.html", "admin-tournaments-new", "New tournament"]);
      adminLinks.push(["admin-organizers.html", "admin-organizers", "Organizers"]);
    }
    adminLinks.push(["admin-tournament.html", "admin-tournament", "Tournament settings"]);
    adminLinks.push(["admin-poll.html", "admin-poll", "Poll"]);
    adminLinks.push(["admin-captains.html", "admin-captains", "Captains"]);
    adminLinks.push(["admin-positions.html", "admin-positions", "Positions"]);
    adminLinks.push(["admin-auction.html", "admin-auction", "Auction control"]);
    adminLinks.push(["admin-schedule.html", "admin-schedule", "Schedule"]);
    adminLinks.push(["admin-scoring.html", "admin-scoring", "Scoring"]);
    adminLinks.push(["admin-playoffs.html", "admin-playoffs", "Playoffs"]);
    if (VB.isSuperAdmin()) adminLinks.push(["admin-users.html", "admin-users", "Users"]);

    const adminDropdown = VB.isOrganizerPlus() ? `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle ${active.startsWith("admin") ? "active" : ""}" href="admin-home.html" role="button" data-bs-toggle="dropdown">Admin</a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="admin-home.html">Admin home</a></li>
          <li><hr class="dropdown-divider"></li>
          ${adminLinks.map(([href, , label]) => `<li><a class="dropdown-item" href="${href}">${label}</a></li>`).join("")}
        </ul>
      </li>` : "";

    const roleSwitcher = `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">${VB.roleBadge(role)}</a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><h6 class="dropdown-header">Preview as (demo)</h6></li>
          ${ROLES.map(r => `<li><a class="dropdown-item ${r === role ? "fw-bold" : ""}" href="#" onclick="VB.setRole('${r}');return false;">${VB.roleLabel(r)}</a></li>`).join("")}
        </ul>
      </li>`;

    return `
    <nav class="navbar navbar-expand-lg navbar-vb sticky-top">
      <div class="container-fluid">
        <a class="navbar-brand" href="home.html">🏐 Estancia<span style="color:var(--brand)">VB</span></a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
          <span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="nav">
          <ul class="navbar-nav me-auto flex-wrap">
            ${participantLinks.map(([h, k, l]) => item(h, k, l)).join("")}
            ${adminDropdown}
          </ul>
          <ul class="navbar-nav align-items-lg-center gap-lg-2">
            <li class="nav-item"><a class="nav-link ${active === "profile" ? "active" : ""}" href="profile.html">${me.name}</a></li>
            ${roleSwitcher}
            <li class="nav-item"><button class="btn btn-sm btn-outline-secondary my-1" onclick="VB.toggleTheme()">◐</button></li>
          </ul>
        </div>
      </div>
    </nav>`;
  };
  VB.mountNav = (active) => {
    const el = document.getElementById("nav-root");
    if (el) el.innerHTML = VB.renderNav(active);
  };

  VB.toggleTheme = () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "" : "dark";
    document.documentElement.setAttribute("data-theme", cur);
    localStorage.setItem("vb_theme", cur);
  };
  VB.initTheme = () => {
    const t = localStorage.getItem("vb_theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  };
  VB.initTheme();

  // ---- poll vote simulation (only affects the demo "player" identity's own entry) ----
  VB.myPollEntry = () => {
    const me = VB.currentUser();
    const override = JSON.parse(localStorage.getItem("vb_poll_override") || "null");
    if (override && override.user_id === me.id) return override;
    return S.poll.entries.find(e => e.user_id === me.id) || null;
  };
  VB.withdrawFromPoll = () => {
    const me = VB.currentUser();
    localStorage.setItem("vb_poll_override", JSON.stringify({ user_id: me.id, status: "withdrawn", submitted_at: new Date().toISOString() }));
  };
  VB.joinPoll = () => {
    const me = VB.currentUser();
    const confirmedCount = S.poll.entries.filter(e => e.status === "confirmed").length;
    const status = confirmedCount < S.poll.capacity ? "confirmed" : "waitlisted";
    localStorage.setItem("vb_poll_override", JSON.stringify({ user_id: me.id, status, submitted_at: new Date().toISOString() }));
  };
})();
