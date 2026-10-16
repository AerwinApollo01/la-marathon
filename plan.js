// Training plan + game engine. Pure logic, no DOM.
// Mirrors "LA Marathon 2027 - Training Plan.xlsx".

const MARATHON_MI = 26.2188;
const RACE_DATE = "2027-03-07";
const DAYS_BEFORE_RACE = 146; // Monday of week 1 (Oct 12, 2026)

// ---- workout builders -------------------------------------------------
const OFF = ["Rest", 0, "Rest day"];
const REST = ["Rest", 0, "Rest, or 20–40 min easy bike (HR 100–115) + strength: calf raises (straight & bent knee), hips, core"];
const E = (n, strides) => ["Easy", n, strides ? "Easy run + 4×20 sec strides on flat ground (quick, relaxed — not a sprint)" : "Easy run — conversational"];
const R = (n) => ["Recovery", n, "Recovery jog — slower than you think"];
const T = (n, d) => ["Tempo", n, `1 mi easy, ${d} @ tempo, 1 mi easy`];
// Saturday aerobic bike: steady (not recovery) effort, shorter before the biggest long runs. Optional.
const B = (mins) => ["Bike", 0, `${mins} min steady bike, HR ~120–135 (Zone 2, ~63–71% of your ~190 max) — conversational, light resistance, 80–95 rpm. Builds aerobic fitness with zero impact. Optional; skip if legs feel heavy for tomorrow's long run.`, mins];
// Fartlek instead of track intervals: same aerobic benefit, far less Achilles / plantar load.
const F = (n, d) => ["Fartlek", n, `1 mi easy, then ${d} comfortably hard with equal easy jogs between. Flat route, smooth form.`];
const M = (n, mp) => ["MP", n, `1 mi easy, ${mp} mi @ marathon pace, 1 mi easy`];
const L = (n, extra) => {
  let d = extra ? `Long run — ${extra}` : n >= 10 ? "Long run, easy. Gel every ~40 min — practice race fueling" : "Long run, easy";
  if (n >= 14) d += ". Run/walk (9 min run : 1 min walk) is encouraged.";
  return ["Long", n, d];
};

const WEEKS = [
  ["Base", "Getting started", [OFF, E(4), OFF, E(3), OFF, ["Easy", 4, "4 mi easy, last mile at a steady, comfortably firm effort (~6/10) — a gentle first taste of faster running"], L(7)]],
  ["Base", "Wake up speed", [REST, E(4), E(3, 1), E(3, 1), REST, OFF, L(7)]],
  ["Base", "Wake up speed", [REST, E(4), E(4, 1), E(3, 1), REST, OFF, L(8)]],
  ["Base", "Cutback + 5K test", [REST, E(3), E(3, 1), OFF, REST, ["Time Trial", 4, "1 mi warm-up + Achilles prep (2×15 slow calf raises, 4 building strides), then 5K at 8–9/10 effort — not all-out. Any Achilles/arch pain over 3/10 → make it an easy run and retest later. Enter your time in Stats."], L(5)]],
  ["Base", "First tempo", [REST, E(4), T(4, "2 mi"), E(4), REST, B(45), L(9)]],
  ["Base", "First fartlek", [REST, E(4), F(5, "6×1 min"), E(4), REST, B(45), L(10)]],
  ["Base", "Thanksgiving week", [REST, E(4), T(5, "3 mi"), E(3, 1), REST, R(2), L(11)]],
  ["Base", "Cutback + 10K test", [REST, E(3), OFF, E(3), REST, ["Time Trial", 8, "1 mi warm-up, 10K ALL-OUT time trial, cool-down. Enter your time in Stats."], R(5)]],
  ["Build", "Tempo build", [REST, E(5), T(6, "4 mi"), E(4), REST, B(45), L(12)]],
  ["Build", "Fartlek", [REST, E(5), F(6, "8×1 min"), E(5), REST, B(45), L(13)]],
  ["Build", "Holiday week", [REST, E(5), M(5, 3), E(4), REST, B(45), L(10)]],
  ["Build", "Tempo build", [REST, E(5), T(7, "2×2.5 mi (3 min jog)"), E(5), REST, B(45), L(14)]],
  ["Build", "Fartlek + MP finish", [REST, E(6), F(7, "6×2 min"), E(5), REST, B(45), L(15, "easy, last 3 mi @ marathon pace")]],
  ["Build", "Cutback + half test", [REST, E(4), E(4, 1), E(3), REST, OFF, ["Time Trial", 13.1, "Half marathon — race it or solo. Full race-morning routine. Enter your time in Stats."]]],
  ["Peak", "MP volume", [REST, E(6), M(7, 5), E(5), REST, R(2), L(16)]],
  ["Peak", "Tempo + 18", [REST, E(6), T(8, "3×2 mi (3 min jog)"), E(6), REST, B(30), L(18)]],
  ["Peak", "Dress rehearsal", [REST, E(5), F(6, "5×3 min"), E(5), REST, R(2), L(14, "easy, last 8 mi @ marathon pace. Race shoes, kit, fuel.")]],
  ["Peak", "The 20-miler", [REST, E(6), M(8, 6), E(5), REST, B(30), L(20)]],
  ["Taper", "Taper 1", [REST, E(5), M(7, 5), E(5), REST, B(40), L(14)]],
  ["Taper", "Taper 2", [REST, E(5), M(6, 4), E(4), REST, B(30), L(10)]],
  ["Race", "RACE WEEK", [OFF, E(4, 1), ["MP", 3, "1 mi easy, 1 mi @ goal pace, 1 mi easy"], E(3), OFF, R(2), ["Race", 26.2, "LA MARATHON — Dodger Stadium → Century City. Start at your tier's pace, not faster."]]],
];

const QUALITY = new Set(["Tempo", "Fartlek", "Intervals", "MP", "Time Trial"]);
const WEEK_ICON = { 4: "🎯", 8: "🎯", 14: "🎯", 18: "⛰️", 21: "🏁" };

// ---- dates (local, no TZ drift) ----------------------------------------
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => fmtKey(new Date());
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

const PLAN_START = fmtKey(addDays(parseDate(RACE_DATE), -DAYS_BEFORE_RACE));

const PLAN = WEEKS.flatMap(([phase, focus, days], wi) =>
  days.map(([type, miles, desc, mins], di) => ({
    week: wi + 1, phase, focus, type, miles, desc, mins,
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
  estimate5k: 31 * 60, // placeholder until the Week 4 time trial
  checkpoints: { k5: null, k10: null, half: null },
  seenBadges: null, // null = first load: don't celebrate history
  lastLevel: null,
  shields: {},   // date → reason ("Sick" | "Niggle" | "Life")
  strength: [],  // dates a strength session was done
  checks: {},    // date → { achilles: 0–10, arch: 0–10 }
  shoe: { name: "", start: "2026-10-01" },
  checklist: {}, // id → true
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
  if (c.k5) { source = "Week 4 5K"; basis = riegel(c.k5, CP.k5, MARATHON_MI); }
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
      MP: z(0.99, 1.01, Math.max(goalMp, mp)), Tempo: z(0.90, 0.93), Fartlek: z(0.87, 0.93),
    },
  };
}
function targetPace(type, fit) {
  if (type === "Bike") return "HR 120–135";
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
function dayStatus(p, byDate, today, shields = {}, crossDates = new Set()) {
  if (p.type === "Bike") return crossDates.has(p.date) ? "done" : p.date > today ? "future" : p.date === today ? "today" : "rest"; // optional: never "missed"
  const a = byDate[p.date]?.miles || 0;
  if (shields[p.date] && a < 0.9 * p.miles) return "shield";
  if (p.date > today) return "future";
  if (p.miles === 0) return a > 0 ? "bonus" : "rest";
  if (a >= 0.9 * p.miles) return "done";
  if (a > 0) return "partial";
  return p.date === today ? "today" : "missed";
}
function weekStats(state, today = todayKey()) {
  const byDate = runsByDate(state);
  const crossDates = new Set(crossOnly(state).map((r) => r.date));
  return WEEKS.map(([phase, focus], wi) => {
    const shields = state.shields || {};
    const days = PLAN.filter((p) => p.week === wi + 1).map((p) => ({ ...p, actual: byDate[p.date]?.miles || 0, status: dayStatus(p, byDate, today, shields, crossDates) }));
    const planned = days.reduce((s, d) => s + d.miles, 0);
    // Shielded days are excused: their miles drop out of the target and they never block stars.
    const target = days.reduce((s, d) => s + (d.status === "shield" ? 0 : d.miles), 0);
    const shielded = days.some((d) => d.status === "shield");
    const actual = days.reduce((s, d) => s + d.actual, 0);
    const start = days[0].date, end = days[6].date;
    const state_ = today > end ? "past" : today >= start ? "current" : "future";
    const long = days.reduce((a, b) => (b.miles > a.miles ? b : a));
    const quality = days.filter((d) => QUALITY.has(d.type) || d.type === "Race");
    const pct = target ? actual / target : 0;
    const ok = (d) => d.status === "done" || d.status === "shield";
    let stars = 0;
    if (state_ !== "future" && target > 0) {
      if (pct >= 0.7) stars = 1;
      if (pct >= 0.9) stars = 2;
      if (pct >= 0.9 && ok(long) && quality.every(ok)) stars = 3;
    }
    return { week: wi + 1, phase, focus, days, planned, target, actual, pct, start, end, state: state_, stars, shielded, longDone: long.status === "done" };
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
const XP = { mile: 10, dayDone: 25, longBonus: 50, qualityBonus: 40, checkpoint: 100, perfectWeek: 100, crossTrain: 15, strength: 20, check: 5, prep: 10 };

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
  xp += new Set(state.strength || []).size * XP.strength;
  xp += Object.keys(state.checks || {}).length * XP.check;
  xp += CHECKLIST.filter((c) => state.checklist?.[c.id]).length * XP.prep;
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
  for (const w of past) { if (w.pct >= 0.8) streak++; else if (w.shielded) continue; else break; }
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
  const bestStreak = (() => { let b = 0, c = 0; for (const w of weeks.filter((w) => w.state !== "future")) { c = w.pct >= 0.8 ? c + 1 : w.shielded ? c : 0; b = Math.max(b, c); } return b; })();
  const has = (pred) => runs.some(pred);
  const onDate = (...ds) => has((r) => ds.includes(r.date));
  const race = runs.find((r) => r.type === "Race" && r.miles >= 26);
  const c = state.checkpoints;
  return [
    ["first", "👟", "First Steps", "Log your first run", runs.length > 0],
    ["baseline", "🎯", "Baseline", "Enter your Week 4 5K", !!c.k5],
    ["quality", "⚡", "Speed Demon", "Log a tempo or fartlek run", has((r) => ["Tempo", "Fartlek", "Intervals"].includes(r.type))],
    ["ten", "🔟", "Double Digits", "Run 10+ miles", longest >= 10],
    ["half", "🌗", "Half Way There", "Run 13.1+ miles", longest >= 13.1],
    ["sixteen", "🧗", "Into the Deep", "Run 16+ miles", longest >= 16],
    ["twenty", "⛰️", "The Big 20", "Run 20+ miles", longest >= 20],
    ["c100", "💯", "Century", "100 total miles", total >= 100],
    ["c250", "🌴", "250 Club", "250 total miles", total >= 250],
    ["c500", "🌅", "500 Club", "500 total miles", total >= 500],
    ["streak4", "🔥", "Hot Streak", "4-week streak", bestStreak >= 4],
    ["streak8", "☄️", "Unbreakable", "8-week streak", bestStreak >= 8],
    ["strength16", "🦵", "Bulletproof", "16 strength sessions", new Set(state.strength || []).size >= 16],
    ["checks14", "🩺", "Body Aware", "14 morning check-ins", Object.keys(state.checks || {}).length >= 14],
    ["shield", "🛡️", "Smart Rest", "Take a shield day instead of running hurt", Object.keys(state.shields || {}).length > 0],
    ["cross10", "🚴", "Recovery Pro", "Log 10 cross-training days", crossDays >= 10],
    ["perfect", "⭐", "Perfect Week", "Earn 3 stars in a week", weeks.some((w) => w.stars === 3)],
    ["turkey", "🦃", "Turkey Burner", "Run on Thanksgiving", onDate("2026-11-26")],
    ["holiday", "🎄", "Holiday Hero", "Run on Christmas Eve or Day", onDate("2026-12-24", "2026-12-25")],
    ["newyear", "🎆", "New Year, New PR", "Run on New Year's Day", onDate("2027-01-01")],
    ["allcp", "📈", "Data Driven", "Complete all 3 checkpoints", !!(c.k5 && c.k10 && c.half)],
    ["sub4pace", "🏎️", "Sub-4 Speed", "Run 3+ mi at 9:09/mi or faster", has((r) => r.miles >= 3 && r.secs && r.secs / r.miles <= state.goalSecs / MARATHON_MI)],
    ["ready", "🎒", "Race Ready", "Finish the race-day checklist", CHECKLIST.every((c) => state.checklist?.[c.id])],
    ["finisher", "🏅", "Marathoner", "Finish the LA Marathon", !!race],
    ["legend", "👑", "Sub-4 Legend", "Finish under 4:00:00", !!(race && race.secs && race.secs < 4 * 3600)],
  ].map(([id, icon, name, desc, earned]) => ({ id, icon, name, desc, earned }));
}

// ---- health -----------------------------------------------------------
// Pain rules for Achilles / plantar fascia (0–10, morning first steps).
function painAdvice(check) {
  if (!check) return null;
  const worst = Math.max(check.achilles ?? 0, check.arch ?? 0);
  if (worst <= 3) return { level: "good", text: "Good to go. Run as planned, keep easy runs easy." };
  if (worst <= 5) return { level: "warn", text: "Easy only today: swap any workout for an easy run or the bike. Stop if it climbs during the run." };
  return { level: "bad", text: "Skip running today. Take a shield day — bike only if it's pain-free." };
}
const SHOE_LIMIT = 400;
function shoeMiles(state) {
  if (!state.shoe?.start) return 0;
  return runsOnly(state).filter((r) => r.date >= state.shoe.start).reduce((s, r) => s + (+r.miles || 0), 0);
}

// ---- race-day checklist -------------------------------------------------
const CHECKLIST = [
  // Rehearsals during training
  { id: "sweat", group: "Rehearse in training", when: "By Wk 10", text: "Sweat test: weigh before & after a 60-min run (no drinking). Each lb lost ≈ 16 oz/hr to replace." },
  { id: "gels", group: "Rehearse in training", when: "Wk 9+", text: "Pick your race gels/chews and use them on every 10+ mi run" },
  { id: "shoes", group: "Rehearse in training", when: "By early Jan", text: "Race shoes bought — same drop as your current pair" },
  { id: "caffeine", group: "Rehearse in training", when: "Wk 12–16", text: "Caffeine trial (~200–230 mg, 45–60 min before) on a long run — note how your stomach handles it" },
  { id: "half", group: "Rehearse in training", when: "Wk 14", text: "Half marathon in race shoes with full race-morning routine" },
  { id: "tier", group: "Rehearse in training", when: "Wk 14", text: "Commit to your goal tier (A / B / C) from the half result" },
  { id: "fuel60", group: "Rehearse in training", when: "Wk 15–18", text: "Hit 60+ g carbs/hr on a 16+ mi long run without stomach issues" },
  { id: "dress", group: "Rehearse in training", when: "Wk 17", text: "Dress rehearsal: race kit, shoes, breakfast, fuel, caffeine — nothing new on race day" },
  // Race week
  { id: "logistics", group: "Race week", when: "Mon–Wed", text: "Confirm bib pickup (expo) and how you'll get to the 7:00 a.m. start — it's point-to-point, so plan the ride home too" },
  { id: "weather", group: "Race week", when: "Wed", text: "Check the forecast. If it's 65°F+ at the finish, plan to start 10–20 sec/mi slower" },
  { id: "nails", group: "Race week", when: "Wed", text: "Trim toenails" },
  { id: "carbload", group: "Race week", when: "Thu–Sat", text: "Carb load: ~620–775 g/day, low fat & fiber, familiar foods" },
  { id: "kit", group: "Race week", when: "Sat night", text: "Lay out: bib + pins, shoes, socks, watch charged, gels counted, caffeine, anti-chafe, throwaway layer" },
  { id: "alarm", group: "Race week", when: "Sat night", text: "Two alarms set — breakfast 2.5–3 hrs before the start" },
  // Race morning
  { id: "breakfast", group: "Race morning", when: "−3 hrs", text: "Practiced breakfast (e.g. pandesal + PB + banana) and ~16 oz fluid" },
  { id: "caf", group: "Race morning", when: "−45 min", text: "Caffeine (if it passed your trial)" },
  { id: "bathroom", group: "Race morning", when: "−30 min", text: "Bathroom line early; gel #1 ~15 min before the start" },
];
const RACE_PLAN = [
  ["🧭", "Miles 1–10", "At or slightly slower than tier pace. Run the hills by effort, not pace. Bank energy, not time."],
  ["🍬", "Fuel", "A gel every 30–40 min from the start (60–90 g carbs/hr). Drink to your sweat-test number."],
  ["📐", "Tangents", "Run the shortest line through every turn — it's worth 2–3 minutes."],
  ["👥", "Miles 10–20", "Settle in, use a pace group if one matches your tier. Stay patient."],
  ["🔥", "Mile 20+", "Now you race. Pick people off. Nothing new — just keep fueling."],
  ["🦶", "If the Achilles or arch talks", "Shorten your stride and add walk breaks — run/walk got you here."],
];
