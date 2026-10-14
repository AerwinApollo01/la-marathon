// Training plan + game engine. Pure logic, no DOM.
// Mirrors "LA Marathon 2027 - Training Plan.xlsx".

const MARATHON_MI = 26.2188;
const RACE_DATE = "2027-03-07";
const DAYS_BEFORE_RACE = 146; // Monday of week 1 (Oct 12, 2026)

// ---- workout builders -------------------------------------------------
const OFF = ["Rest", 0, "Rest day"];
const REST = ["Rest", 0, "Rest, or 30–40 min easy cross-training + 20 min strength"];
const E = (n, strides) => ["Easy", n, strides ? "Easy run + 4×20 sec strides (quick, relaxed)" : "Easy run — conversational"];
const R = (n) => ["Recovery", n, "Recovery jog — slower than you think"];
const T = (n, d) => ["Tempo", n, `1 mi easy, ${d} @ tempo, 1 mi easy`];
const I = (n, d) => ["Intervals", n, `1 mi easy, ${d} @ interval pace, 1 mi easy`];
const M = (n, mp) => ["MP", n, `1 mi easy, ${mp} mi @ marathon pace, 1 mi easy`];
const L = (n, extra) => ["Long", n, extra ? `Long run — ${extra}` : n >= 10 ? "Long run, easy. Gel every ~40 min — practice race fueling" : "Long run, easy"];

const WEEKS = [
  ["Base", "Baseline 5K test", [OFF, E(4), OFF, E(3), OFF, ["Time Trial", 4, "1 mi warm-up, 5K ALL-OUT time trial, cool-down. Enter your time in Stats."], L(5)]],
  ["Base", "Consistency", [REST, E(4), E(3, 1), E(3), REST, OFF, L(7)]],
  ["Base", "Consistency", [REST, E(4), E(4, 1), E(3), REST, OFF, L(8)]],
  ["Base", "Cutback", [REST, E(3), E(3, 1), E(3), REST, OFF, L(5)]],
  ["Base", "First tempo", [REST, E(4), T(4, "2 mi"), E(4), REST, OFF, L(9)]],
  ["Base", "First intervals", [REST, E(4), I(5, "5×800m (400m jog)"), E(4), REST, OFF, L(10)]],
  ["Base", "Thanksgiving week", [REST, E(4), T(5, "3 mi"), E(3, 1), REST, R(2), L(11)]],
  ["Base", "Cutback + 10K test", [REST, E(3), OFF, E(3), REST, ["Time Trial", 8, "1 mi warm-up, 10K ALL-OUT time trial, cool-down. Enter your time in Stats."], R(5)]],
  ["Build", "Tempo build", [REST, E(5), T(6, "4 mi"), E(4), REST, OFF, L(12)]],
  ["Build", "Speed", [REST, E(5), I(6, "6×800m (400m jog)"), E(5), REST, OFF, L(13)]],
  ["Build", "Holiday week", [REST, E(5), M(5, 3), E(4), REST, OFF, L(10)]],
  ["Build", "Tempo build", [REST, E(5), T(7, "2×2.5 mi (3 min jog)"), E(5), REST, OFF, L(14)]],
  ["Build", "Speed + MP finish", [REST, E(6), I(7, "4×1 mi (3 min jog)"), E(5), REST, OFF, L(15, "easy, last 3 mi @ marathon pace")]],
  ["Build", "Cutback + half test", [REST, E(4), E(4, 1), E(3), REST, OFF, ["Time Trial", 13.1, "Half marathon — race it or solo. Full race-morning routine. Enter your time in Stats."]]],
  ["Peak", "MP volume", [REST, E(6), M(7, 5), E(5), REST, R(2), L(16)]],
  ["Peak", "Tempo + 18", [REST, E(6), T(8, "3×2 mi (3 min jog)"), E(6), REST, OFF, L(18)]],
  ["Peak", "Dress rehearsal", [REST, E(5), I(6, "5×1K (2 min jog)"), E(5), REST, R(2), L(14, "easy, last 8 mi @ marathon pace. Race shoes, kit, fuel.")]],
  ["Peak", "The 20-miler", [REST, E(6), M(8, 6), E(5), REST, OFF, L(20)]],
  ["Taper", "Taper 1", [REST, E(5), M(7, 5), E(5), REST, OFF, L(14)]],
  ["Taper", "Taper 2", [REST, E(5), M(6, 4), E(4), REST, OFF, L(10)]],
  ["Race", "RACE WEEK", [OFF, E(4, 1), ["MP", 3, "1 mi easy, 1 mi @ goal pace, 1 mi easy"], E(3), OFF, R(2), ["Race", 26.2, "LA MARATHON — Dodger Stadium → Century City. Start at your tier's pace, not faster."]]],
];

const QUALITY = new Set(["Tempo", "Intervals", "MP", "Time Trial"]);
const WEEK_ICON = { 1: "🎯", 8: "🎯", 14: "🎯", 18: "⛰️", 21: "🏁" };

// ---- dates (local, no TZ drift) ----------------------------------------
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => fmtKey(new Date());
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

const PLAN_START = fmtKey(addDays(parseDate(RACE_DATE), -DAYS_BEFORE_RACE));

const PLAN = WEEKS.flatMap(([phase, focus, days], wi) =>
  days.map(([type, miles, desc], di) => ({
    week: wi + 1, phase, focus, type, miles, desc,
    date: fmtKey(addDays(parseDate(PLAN_START), wi * 7 + di)),
  }))
);
const PLAN_BY_DATE = Object.fromEntries(PLAN.map((p) => [p.date, p]));

// ---- time & pace ------------------------------------------------------
function parseDuration(str) {
  // "45" = minutes, "45:30" = m:ss, "1:45:30" = h:mm:ss  → seconds
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (!s.includes(":")) { const m = parseFloat(s); return isFinite(m) ? Math.round(m * 60) : null; }
  const p = s.split(":").map(Number);
  if (p.some((x) => !isFinite(x))) return null;
  return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}
function fmtDuration(sec, forceHours) {
  if (sec == null || !isFinite(sec)) return "—";
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const ss = String(s).padStart(2, "0");
  return h || forceHours ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
const fmtPace = (secPerMi) => (secPerMi ? fmtDuration(secPerMi) : "—");

// ---- state ------------------------------------------------------------
const STORE_KEY = "la-marathon-2027";
const DEFAULT_STATE = {
  runs: [
    { id: "seed1", date: "2026-10-11", type: "Long", miles: 6.5, secs: 5400, effort: null, notes: "From spreadsheet" },
    { id: "seed2", date: "2026-10-13", type: "Easy", miles: 4, secs: 3600, effort: null, notes: "From spreadsheet" },
  ],
  goalSecs: 4 * 3600,
  tierB: 4.5 * 3600,
  tierC: 5 * 3600 - 1,
  estimate5k: 31 * 60, // placeholder until the Week 1 time trial
  checkpoints: { k5: null, k10: null, half: null },
  seenBadges: null, // null = first load: don't celebrate history
  lastLevel: null,
};
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch (e) { /* fall through */ }
  return structuredClone(DEFAULT_STATE);
}
function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
}

// ---- fitness model (Riegel, same as spreadsheet) -----------------------
const RIEGEL = 1.06;
const CP = { k5: 3.10686, k10: 6.21371, half: 13.1094 };
const riegel = (secs, fromMi, toMi) => secs * Math.pow(toMi / fromMi, RIEGEL);

function fitness(state) {
  const c = state.checkpoints;
  let source = "Starting estimate", basis = riegel(state.estimate5k, CP.k5, MARATHON_MI);
  if (c.k5) { source = "Week 1 5K"; basis = riegel(c.k5, CP.k5, MARATHON_MI); }
  if (c.k10) { source = "Week 8 10K"; basis = riegel(c.k10, CP.k10, MARATHON_MI); }
  if (c.half) { source = "Week 14 half"; basis = riegel(c.half, CP.half, MARATHON_MI); }
  const mp = basis / MARATHON_MI;
  const goalMp = state.goalSecs / MARATHON_MI;
  const tier = basis <= state.goalSecs ? "A" : basis <= state.tierB ? "B" : basis <= state.tierC ? "C" : null;
  const z = (lo, hi, base = mp) => [base * lo, base * hi];
  return {
    predicted: basis, mp, goalMp, source, tier,
    gapMin: (basis - state.goalSecs) / 60,
    needed: Object.fromEntries(Object.entries(CP).map(([k, mi]) => [k, riegel(state.goalSecs, MARATHON_MI, mi)])),
    zones: {
      Recovery: z(1.25, 1.35), Easy: z(1.13, 1.25), Long: z(1.08, 1.18),
      MP: z(0.99, 1.01, Math.max(goalMp, mp)), Tempo: z(0.90, 0.93), Intervals: z(0.83, 0.86),
    },
  };
}
function targetPace(type, fit) {
  if (fit.zones[type]) return `${fmtPace(fit.zones[type][0])}–${fmtPace(fit.zones[type][1])}`;
  if (type === "Time Trial") return "All-out";
  if (type === "Race") return `${fmtPace(fit.goalMp)} goal`;
  return "";
}

// ---- progress ---------------------------------------------------------
// Cross-training is logged in minutes and never counts toward running miles.
const isCross = (r) => r.type === "Cross-train";
const runsOnly = (state) => state.runs.filter((r) => !isCross(r));
const crossOnly = (state) => state.runs.filter(isCross);

function runsByDate(state) {
  const m = {};
  for (const r of runsOnly(state)) {
    const e = (m[r.date] ||= { miles: 0, secs: 0, count: 0 });
    e.miles += +r.miles || 0; e.secs += +r.secs || 0; e.count++;
  }
  return m;
}
function dayStatus(p, byDate, today) {
  const a = byDate[p.date]?.miles || 0;
  if (p.date > today) return "future";
  if (p.miles === 0) return a > 0 ? "bonus" : "rest";
  if (a >= 0.9 * p.miles) return "done";
  if (a > 0) return "partial";
  return p.date === today ? "today" : "missed";
}
function weekStats(state, today = todayKey()) {
  const byDate = runsByDate(state);
  return WEEKS.map(([phase, focus], wi) => {
    const days = PLAN.filter((p) => p.week === wi + 1).map((p) => ({ ...p, actual: byDate[p.date]?.miles || 0, status: dayStatus(p, byDate, today) }));
    const planned = days.reduce((s, d) => s + d.miles, 0);
    const actual = days.reduce((s, d) => s + d.actual, 0);
    const start = days[0].date, end = days[6].date;
    const state_ = today > end ? "past" : today >= start ? "current" : "future";
    const long = days.reduce((a, b) => (b.miles > a.miles ? b : a));
    const quality = days.filter((d) => QUALITY.has(d.type) || d.type === "Race");
    const pct = planned ? actual / planned : 0;
    let stars = 0;
    if (state_ !== "future") {
      if (pct >= 0.7) stars = 1;
      if (pct >= 0.9) stars = 2;
      if (pct >= 0.9 && long.status === "done" && quality.every((q) => q.status === "done")) stars = 3;
    }
    return { week: wi + 1, phase, focus, days, planned, actual, pct, start, end, state: state_, stars, longDone: long.status === "done" };
  });
}

// ---- XP & levels ------------------------------------------------------
// Level names follow the LA Marathon course, start to finish.
const LEVELS = [
  [0, "Dodger Stadium", "Lacing up at the start line"],
  [150, "Chinatown", "Rolling downhill out of the stadium"],
  [400, "Little Tokyo", "Finding your rhythm downtown"],
  [800, "Echo Park", "Hills? You eat hills"],
  [1400, "Silver Lake", "Cruising the east side"],
  [2200, "Los Feliz", "Halfway-to-somewhere energy"],
  [3200, "Hollywood", "Walk of Fame runner"],
  [4500, "Sunset Strip", "Golden-hour miles"],
  [6000, "Beverly Hills", "Rodeo Drive-level fitness"],
  [8000, "Century City", "Finish line in sight"],
];
const XP = { mile: 10, dayDone: 25, longBonus: 50, qualityBonus: 40, checkpoint: 100, perfectWeek: 100, crossTrain: 15 };

function computeXP(state) {
  const today = todayKey();
  let xp = 0;
  const log = [];
  const miles = runsOnly(state).reduce((s, r) => s + (+r.miles || 0), 0);
  xp += Math.round(miles * XP.mile);
  xp += new Set(crossOnly(state).map((r) => r.date)).size * XP.crossTrain; // once per day
  for (const w of weekStats(state, today)) {
    for (const d of w.days) {
      if (d.status !== "done") continue;
      xp += XP.dayDone;
      if (d.type === "Long" || d.type === "Race") xp += XP.longBonus;
      if (QUALITY.has(d.type)) xp += XP.qualityBonus;
    }
    if (w.stars === 3) xp += XP.perfectWeek;
  }
  xp += Object.values(state.checkpoints).filter(Boolean).length * XP.checkpoint;
  return xp;
}
function levelFor(xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const [floor, name, tag] = LEVELS[i];
  const next = LEVELS[i + 1]?.[0] ?? null;
  return { n: i + 1, name, tag, floor, next, progress: next ? (xp - floor) / (next - floor) : 1 };
}

// Streak: consecutive weeks hitting ≥80% of planned miles (rest days never break it).
function weekStreak(weeks) {
  let streak = 0;
  const cur = weeks.find((w) => w.state === "current");
  const past = weeks.filter((w) => w.state === "past").reverse();
  for (const w of past) { if (w.pct >= 0.8) streak++; else break; }
  if (cur && cur.pct >= 0.8) streak++;
  return streak;
}

// ---- badges -----------------------------------------------------------
function badges(state) {
  const runs = runsOnly(state);
  const crossDays = new Set(crossOnly(state).map((r) => r.date)).size;
  const total = runs.reduce((s, r) => s + (+r.miles || 0), 0);
  const longest = runs.reduce((m, r) => Math.max(m, +r.miles || 0), 0);
  const weeks = weekStats(state);
  const bestStreak = (() => { let b = 0, c = 0; for (const w of weeks.filter((w) => w.state !== "future")) { c = w.pct >= 0.8 ? c + 1 : 0; b = Math.max(b, c); } return b; })();
  const has = (pred) => runs.some(pred);
  const onDate = (...ds) => has((r) => ds.includes(r.date));
  const race = runs.find((r) => r.type === "Race" && r.miles >= 26);
  const c = state.checkpoints;
  return [
    ["first", "👟", "First Steps", "Log your first run", runs.length > 0],
    ["baseline", "🎯", "Baseline", "Enter your Week 1 5K", !!c.k5],
    ["quality", "⚡", "Speed Demon", "Log a tempo or interval run", has((r) => r.type === "Tempo" || r.type === "Intervals")],
    ["ten", "🔟", "Double Digits", "Run 10+ miles", longest >= 10],
    ["half", "🌗", "Half Way There", "Run 13.1+ miles", longest >= 13.1],
    ["sixteen", "🧗", "Into the Deep", "Run 16+ miles", longest >= 16],
    ["twenty", "⛰️", "The Big 20", "Run 20+ miles", longest >= 20],
    ["c100", "💯", "Century", "100 total miles", total >= 100],
    ["c250", "🌴", "250 Club", "250 total miles", total >= 250],
    ["c500", "🌅", "500 Club", "500 total miles", total >= 500],
    ["streak4", "🔥", "Hot Streak", "4-week streak", bestStreak >= 4],
    ["streak8", "☄️", "Unbreakable", "8-week streak", bestStreak >= 8],
    ["cross10", "🚴", "Recovery Pro", "Log 10 cross-training days", crossDays >= 10],
    ["perfect", "⭐", "Perfect Week", "Earn 3 stars in a week", weeks.some((w) => w.stars === 3)],
    ["turkey", "🦃", "Turkey Burner", "Run on Thanksgiving", onDate("2026-11-26")],
    ["holiday", "🎄", "Holiday Hero", "Run on Christmas Eve or Day", onDate("2026-12-24", "2026-12-25")],
    ["newyear", "🎆", "New Year, New PR", "Run on New Year's Day", onDate("2027-01-01")],
    ["allcp", "📈", "Data Driven", "Complete all 3 checkpoints", !!(c.k5 && c.k10 && c.half)],
    ["sub4pace", "🏎️", "Sub-4 Speed", "Run 3+ mi at 9:09/mi or faster", has((r) => r.miles >= 3 && r.secs && r.secs / r.miles <= state.goalSecs / MARATHON_MI)],
    ["finisher", "🏅", "Marathoner", "Finish the LA Marathon", !!race],
    ["legend", "👑", "Sub-4 Legend", "Finish under 4:00:00", !!(race && race.secs && race.secs < 4 * 3600)],
  ].map(([id, icon, name, desc, earned]) => ({ id, icon, name, desc, earned }));
}
