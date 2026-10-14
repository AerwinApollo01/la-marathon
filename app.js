// UI layer. Depends on plan.js globals.

const TYPE_COLOR = {
  Rest: "var(--t-rest)", Easy: "var(--t-easy)", Recovery: "var(--t-recovery)", Long: "var(--t-long)",
  Tempo: "var(--t-tempo)", Intervals: "var(--t-intervals)", MP: "var(--t-mp)", "Time Trial": "var(--t-tt)",
  Race: "var(--t-race)", "Cross-train": "#8C9AC4",
};
const TYPE_ICON = {
  Rest: "😴", Easy: "🏃", Recovery: "🚶", Long: "🛣️", Tempo: "⚡", Intervals: "🔥", MP: "🎯",
  "Time Trial": "⏱️", Race: "🏁", "Cross-train": "🚴",
};
const LOG_TYPES = ["Easy", "Long", "Tempo", "Intervals", "MP", "Recovery", "Time Trial", "Race", "Cross-train"];
const EFFORT = ["", "Barely moving", "Very easy", "Easy", "Comfortable", "Steady", "Moderate", "Hard-ish", "Hard", "Very hard", "All-out"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let state = loadState();
let tab = "today";
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMi = (n) => (Math.round(n * 10) / 10).toString();
const prettyDate = (key, opts = { weekday: "short", month: "short", day: "numeric" }) => parseDate(key).toLocaleDateString(undefined, opts);
const pill = (type) => `<span class="pill" style="background:${TYPE_COLOR[type] || "#888"}">${TYPE_ICON[type] || ""} ${esc(type === "MP" ? "Marathon pace" : type)}</span>`;

// ======================================================================
// Rewards
// ======================================================================
function snapshot() {
  const xp = computeXP(state);
  return { xp, level: levelFor(xp), earned: badges(state).filter((b) => b.earned).map((b) => b.id) };
}
function commit(mutator) {
  const before = snapshot();
  mutator();
  saveState(state);
  const after = snapshot();
  const gained = after.xp - before.xp;
  const queue = [];
  if (after.level.n > before.level.n) {
    queue.push({ em: "🎉", title: `Level ${after.level.n}: ${after.level.name}`, desc: after.level.tag });
  }
  const all = badges(state);
  for (const id of after.earned) {
    if (!state.seenBadges.includes(id)) {
      const b = all.find((x) => x.id === id);
      queue.push({ em: b.icon, title: `Badge unlocked: ${b.name}`, desc: b.desc });
    }
  }
  state.seenBadges = after.earned;
  state.lastLevel = after.level.n;
  saveState(state);
  render();
  if (queue.length) celebrate(queue);
  else if (gained > 0) toast(`+${gained} XP`);
}
function initRewards() {
  if (state.seenBadges == null) {
    const s = snapshot();
    state.seenBadges = s.earned;
    state.lastLevel = s.level.n;
    saveState(state);
  }
}

// ======================================================================
// Views
// ======================================================================
function render() {
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const view = $("#view");
  view.innerHTML = { today: viewToday, journey: viewJourney, runs: viewRuns, stats: viewStats, trophies: viewTrophies }[tab]();
  view.style.animation = "none"; void view.offsetWidth; view.style.animation = "";
  bindView();
}

function heroCard(xp, lvl, streak) {
  const days = daysBetween(todayKey(), RACE_DATE);
  const countdown = days > 0
    ? `<div class="countdown num grad-text">${days}<small>days to go</small></div>`
    : days === 0 ? `<div class="countdown grad-text">RACE DAY</div>` : `<div class="countdown grad-text">Done 🏅</div>`;
  return `
  <section class="hero">
    <div class="sun"></div><div class="palms">🌴</div>
    <div class="eyebrow">LA Marathon · Sun Mar 7, 2027</div>
    <div style="margin:8px 0 14px">${countdown}</div>
    <div class="chips">
      <span class="chip fire">🔥 ${streak ? `${streak}-week streak` : "Start a streak"}</span>
      <span class="chip gold">⚡ ${xp.toLocaleString()} XP</span>
    </div>
    <div style="margin-top:14px">
      <div class="row between" style="margin-bottom:6px">
        <b style="font-size:14px">Lv ${lvl.n} · ${esc(lvl.name)}</b>
        <span class="muted num" style="font-size:12px">${lvl.next ? `${(lvl.next - xp).toLocaleString()} XP to next` : "Max level"}</span>
      </div>
      <div class="xpbar"><i style="width:${Math.round(lvl.progress * 100)}%"></i></div>
    </div>
  </section>`;
}

function viewToday() {
  const today = todayKey();
  const fit = fitness(state);
  const xp = computeXP(state);
  const lvl = levelFor(xp);
  const weeks = weekStats(state, today);
  const streak = weekStreak(weeks);
  const byDate = runsByDate(state);
  const p = PLAN_BY_DATE[today];
  let main = "";

  if (!p && today < PLAN_START) {
    main = `<section class="card"><div class="h2">Plan starts ${prettyDate(PLAN_START)}</div><p class="muted" style="margin-top:6px">Easy miles until then — log anything you run.</p></section>`;
  } else if (!p) {
    main = `<section class="card"><div class="h2">The plan is complete 🏅</div><p class="muted" style="margin-top:6px">Recover, then pick the next one.</p></section>`;
  } else {
    const done = byDate[today]?.miles || 0;
    const complete = p.miles > 0 && done >= 0.9 * p.miles;
    const pace = targetPace(p.type, fit);
    main = `
    <section class="card workout">
      <div class="row between">${pill(p.type)}<span class="muted" style="font-size:13px;font-weight:700">Week ${p.week} · ${esc(p.phase)}</span></div>
      <div style="margin:14px 0 6px" class="eyebrow">Today · ${prettyDate(today)}</div>
      ${p.miles ? `<div class="big num">${fmtMi(p.miles)}<small>mi</small></div>` : `<div class="big">Rest</div>`}
      <p style="margin:10px 0 14px; line-height:1.45">${esc(p.desc)}</p>
      ${pace ? `<div class="pace-box"><span style="font-size:20px">⏱️</span><div><div class="muted" style="font-size:12px;font-weight:700">TARGET PACE / MI</div><b class="num" style="font-size:18px">${pace}</b></div></div>` : ""}
      <div style="margin-top:14px">
        ${complete
          ? `<div class="done-banner">✅ Done — ${fmtMi(done)} mi logged. Nice work.</div>`
          : p.miles
            ? `<button class="btn" data-action="log-today">Log today's run</button>`
            : `<p class="muted" style="font-size:14px">Recovery is training. Optional: 20 min strength — squats, lunges, calf raises, planks.</p>`}
      </div>
    </section>`;
  }

  const w = weeks.find((x) => x.state === "current");
  const weekCard = w ? `
    <section class="card">
      <div class="row between" style="margin-bottom:12px">
        <div><div class="h2">This week</div><div class="muted" style="font-size:13px">${esc(w.focus)}</div></div>
        <div class="right"><b class="num" style="font-size:20px">${fmtMi(w.actual)}</b><span class="muted num"> / ${fmtMi(w.planned)} mi</span></div>
      </div>
      <div class="strip">
        ${w.days.map((d, i) => `
          <div class="dayc ${d.date === today ? "is-today" : ""}">
            <span>${DOW[i][0]}</span>
            <div class="dot ${d.date === today && d.status !== "done" ? "today" : d.status}" title="${esc(d.type)}">${d.status === "done" ? "✓" : d.miles ? fmtMi(d.miles) : "–"}</div>
          </div>`).join("")}
      </div>
      <div class="progress" style="margin-top:14px"><i style="width:${Math.min(100, Math.round(w.pct * 100))}%"></i></div>
      <div class="row between muted" style="font-size:12px;margin-top:6px;font-weight:650">
        <span>${"⭐".repeat(w.stars)}${"☆".repeat(3 - w.stars)} ${w.stars === 3 ? "Perfect week!" : "Hit 90% + long run + workout for ⭐⭐⭐"}</span>
      </div>
    </section>` : "";

  const tomorrow = PLAN_BY_DATE[fmtKey(addDays(parseDate(today), 1))];
  const next = tomorrow ? `
    <section class="card flush"><div class="list">
      <div class="li"><div class="ic" style="background:${TYPE_COLOR[tomorrow.type]}22">${TYPE_ICON[tomorrow.type]}</div>
        <div class="grow"><div class="eyebrow">Tomorrow</div><div class="title">${tomorrow.miles ? `${fmtMi(tomorrow.miles)} mi · ` : ""}${esc(tomorrow.type === "MP" ? "Marathon pace" : tomorrow.type)}</div>
        <div class="sub">${esc(tomorrow.desc)}</div></div></div>
    </div></section>` : "";

  return `${heroCard(xp, lvl, streak)}${main}${weekCard}${next}`;
}

function viewJourney() {
  const weeks = weekStats(state);
  let html = `<div><div class="eyebrow">21 weeks · Oct 12 → Mar 7</div><div class="h1">The Road to LA</div></div><div class="path">`;
  let lastPhase = "";
  weeks.forEach((w, i) => {
    if (w.phase !== lastPhase) {
      lastPhase = w.phase;
      html += `<div class="phase-banner"><span>${{ Base: "🌱 Base", Build: "🧱 Build", Peak: "⛰️ Peak", Taper: "🧘 Taper", Race: "🏁 Race" }[w.phase]}</span></div>`;
    }
    const x = Math.round(Math.sin(i * 0.85) * 90);
    const cls = w.state === "past" ? `past ${w.pct === 0 ? "zero" : w.stars < 2 ? "weak" : ""}` : w.state;
    const label = w.state === "past" && w.stars ? "" : w.state === "past" && w.pct === 0 ? "✕" : w.week;
    html += `
      <div class="node-row" style="justify-content:center">
        <button class="node ${cls}" style="transform:translateX(${x}px)" data-week="${w.week}" aria-label="Week ${w.week}: ${esc(w.focus)}">
          ${w.state === "current" ? `<span class="you">YOU</span>` : ""}
          ${WEEK_ICON[w.week] ? `<span class="badge-ic">${WEEK_ICON[w.week]}</span>` : ""}
          <span class="disc">${w.state === "past" && w.stars ? "✓" : label}</span>
          <span class="stars">${w.state === "future" ? "" : "⭐".repeat(w.stars) + "☆".repeat(3 - w.stars)}</span>
          <span class="lbl">${prettyDate(w.start, { month: "short", day: "numeric" })} · ${fmtMi(w.planned)} mi</span>
        </button>
      </div>`;
  });
  return html + `</div>`;
}

function viewRuns() {
  const runs = [...state.runs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const total = runsOnly(state).reduce((s, r) => s + (+r.miles || 0), 0);
  const nRuns = runsOnly(state).length;
  const xMins = crossOnly(state).reduce((s, r) => s + (r.secs || 0) / 60, 0);
  const items = runs.map((r) => {
    const wk = PLAN_BY_DATE[r.date]?.week;
    const right = isCross(r)
      ? `<b>${Math.round((r.secs || 0) / 60)} min</b><div class="muted" style="font-size:13px">${r.hr ? `${r.hr} bpm` : ""}</div>`
      : `<b>${fmtMi(r.miles)} mi</b><div class="muted" style="font-size:13px">${r.secs && r.miles ? fmtPace(r.secs / r.miles) + "/mi" : ""}</div>`;
    return `
    <button class="li" data-run="${r.id}">
      <div class="ic" style="background:${TYPE_COLOR[r.type] || "#888"}22">${TYPE_ICON[r.type] || "🏃"}</div>
      <div class="grow"><div class="title">${esc(r.type === "MP" ? "Marathon pace" : r.type)}</div>
        <div class="sub">${prettyDate(r.date)}${wk ? ` · Wk ${wk}` : ""}${r.effort ? ` · RPE ${r.effort}` : ""}${r.notes ? ` · ${esc(r.notes)}` : ""}</div></div>
      <div class="right">${right}</div>
    </button>`;
  }).join("");
  return `
    <div><div class="eyebrow">Run log</div><div class="h1 num">${fmtMi(total)} miles</div><div class="muted">${nRuns} runs${xMins ? ` · ${Math.round(xMins)} min cross-training` : ""}</div></div>
    <section class="card flush"><div class="list">${items || `<div class="li muted">No runs yet — tap ＋ to log one.</div>`}</div></section>`;
}

function viewStats() {
  const fit = fitness(state);
  const weeks = weekStats(state);
  const runs = runsOnly(state);
  const total = runs.reduce((s, r) => s + (+r.miles || 0), 0);
  const longest = runs.reduce((m, r) => Math.max(m, +r.miles || 0), 0);
  const tiers = [["A", "Stretch", state.goalSecs], ["B", "Realistic", state.tierB], ["C", "Floor", state.tierC]];
  const gap = fit.gapMin;
  const cps = [
    ["k5", "5K time trial", "Week 1", false],
    ["k10", "10K time trial", "Week 8", false],
    ["half", "Half marathon", "Week 14", true],
  ];
  return `
    <div><div class="eyebrow">Fitness</div><div class="h1">Stats</div></div>

    <section class="card">
      <div class="eyebrow">Predicted marathon · from ${esc(fit.source)}</div>
      <div class="row between" style="margin:6px 0 4px">
        <div class="h1 num" style="font-size:40px">${fmtDuration(fit.predicted, true)}</div>
        <div class="right"><b class="num" style="color:${gap <= 0 ? "var(--good)" : "var(--warn)"}">${gap <= 0 ? `${Math.round(-gap)} min under` : `${Math.round(gap)} min to go`}</b><div class="muted" style="font-size:12px">vs. sub-4</div></div>
      </div>
      ${fit.source === "Starting estimate" ? `<p class="muted" style="font-size:13px;margin-bottom:10px">⚠️ A placeholder guess until you run the Week 1 5K.</p>` : ""}
      <div class="tier-row" style="margin-top:10px">
        ${tiers.map(([k, n, s]) => `<div class="tier ${fit.tier === k ? "on" : ""}"><b>${k} · ${fmtDuration(s + (k === "C" ? 1 : 0), true).replace(/:00$/, "")}</b><span>${n} · ${fmtPace(s / MARATHON_MI)}/mi</span></div>`).join("")}
      </div>
      <p class="muted" style="font-size:12px;margin-top:10px">Tracking toward: <b style="color:var(--text)">${fit.tier ? `${fit.tier} goal` : "build first"}</b>. Pick your race-day tier after the Week 14 half.</p>
    </section>

    <section class="card">
      <div class="h2" style="margin-bottom:4px">Checkpoints</div>
      <p class="muted" style="font-size:13px;margin-bottom:6px">Enter results as m:ss or h:mm:ss. All paces update automatically.</p>
      ${cps.map(([k, name, wk, hrs]) => `
        <div class="cp">
          <div><b>${name}</b> <span class="muted" style="font-size:12px">· ${wk}</span>
            <div class="muted" style="font-size:12px">Sub-4 needs ≈ ${fmtDuration(fit.needed[k], hrs)}</div></div>
          <input class="input num" data-cp="${k}" autocomplete="off" placeholder="${hrs ? "h:mm:ss" : "mm:ss"}" value="${state.checkpoints[k] ? fmtDuration(state.checkpoints[k], hrs) : ""}" />
        </div>`).join("")}
    </section>

    <div class="kpis">
      <div class="kpi"><b>${fmtMi(total)}</b><span>Total miles</span></div>
      <div class="kpi"><b>${fmtMi(longest)}</b><span>Longest run</span></div>
      <div class="kpi"><b>${weeks.reduce((s, w) => s + w.stars, 0)}</b><span>Stars earned</span></div>
    </div>

    <section class="card">
      <div class="row between" style="margin-bottom:10px">
        <div class="h2">Weekly miles</div>
        <div class="legend"><span><i style="background:var(--planned)"></i>Planned</span><span><i style="background:var(--actual)"></i>Actual</span></div>
      </div>
      ${weeklyChart(weeks)}
      <details style="margin-top:10px"><summary>Show as table</summary>
        <table class="mini"><tr><th>Week</th><th>Planned</th><th>Actual</th><th>Stars</th></tr>
        ${weeks.map((w) => `<tr><td>${w.week} · ${prettyDate(w.start, { month: "short", day: "numeric" })}</td><td>${fmtMi(w.planned)}</td><td>${w.state === "future" ? "—" : fmtMi(w.actual)}</td><td>${w.state === "future" ? "" : "⭐".repeat(w.stars)}</td></tr>`).join("")}
        </table></details>
    </section>

    <section class="card">
      <div class="h2" style="margin-bottom:6px">Pace zones <span class="muted" style="font-size:13px;font-weight:600">min/mi</span></div>
      ${Object.entries(fit.zones).map(([z, [a, b]]) => `
        <div class="zone-row"><i style="background:${TYPE_COLOR[z]}"></i><span>${z === "MP" ? "Marathon pace" : z}</span><b class="num">${fmtPace(a)}–${fmtPace(b)}</b></div>`).join("")}
      <p class="muted" style="font-size:12px;margin-top:6px">Based on current fitness, not goal. Marathon pace never goes faster than ${fmtPace(fit.goalMp)}.</p>
    </section>

    <section class="card">
      <div class="h2" style="margin-bottom:10px">Settings & data</div>
      <div class="grid2">
        <div class="field"><label>Tier B time</label><input class="input num" data-setting="tierB" value="${fmtDuration(state.tierB, true)}" /></div>
        <div class="field"><label>Tier C time</label><input class="input num" data-setting="tierC" value="${fmtDuration(state.tierC, true)}" /></div>
      </div>
      <p class="muted" style="font-size:12px;margin:10px 0 14px">Your data lives only on this device. Export a backup now and then.</p>
      <div class="grid2">
        <button class="btn ghost small" data-action="export">⬇️ Export backup</button>
        <button class="btn ghost small" data-action="import">⬆️ Import backup</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden />
    </section>`;
}

function weeklyChart(weeks) {
  const W = 340, H = 170, pad = { l: 26, r: 4, t: 8, b: 20 };
  const max = Math.ceil(Math.max(40, ...weeks.map((w) => Math.max(w.planned, w.actual))) / 10) * 10;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const gw = iw / weeks.length, bw = Math.max(3, (gw - 4) / 2 - 1);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const bar = (x, v, color) => {
    if (v <= 0) return "";
    const h = Math.max(1, ih - (y(v) - pad.t)), r = Math.min(3, bw / 2, h), top = y(v), base = pad.t + ih;
    return `<path d="M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z" fill="${color}"/>`;
  };
  let grid = "";
  for (let v = 10; v <= max; v += 10) grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pad.l - 6}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="var(--faint)">${v}</text>`;
  let bars = "", hits = "", labels = "";
  weeks.forEach((w, i) => {
    const gx = pad.l + i * gw + 2;
    bars += bar(gx, w.planned, "var(--planned)");
    if (w.state !== "future") bars += bar(gx + bw + 2, w.actual, "var(--actual)");
    hits += `<rect x="${pad.l + i * gw}" y="${pad.t}" width="${gw}" height="${ih}" fill="transparent" data-tip="${i}"/>`;
    if ((i + 1) % 4 === 1 || i === weeks.length - 1) labels += `<text x="${gx + bw}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--faint)">${w.week}</text>`;
  });
  const tipData = esc(JSON.stringify(weeks.map((w) => [w.week, prettyDate(w.start, { month: "short", day: "numeric" }), fmtMi(w.planned), w.state === "future" ? null : fmtMi(w.actual)])));
  return `<div class="chart-wrap" data-tips="${tipData}">
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Weekly planned versus actual miles">
      ${grid}<line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="var(--faint)"/>
      ${bars}${labels}<g class="hits">${hits}</g>
    </svg><div class="chart-tip" hidden></div></div>`;
}

function viewTrophies() {
  const xp = computeXP(state);
  const lvl = levelFor(xp);
  const all = badges(state);
  const earned = all.filter((b) => b.earned).length;
  return `
    <div><div class="eyebrow">Trophy case</div><div class="h1">${earned} / ${all.length} badges</div></div>
    <div class="badges">
      ${all.map((b) => `<div class="badge ${b.earned ? "earned" : "locked"}"><span class="em">${b.icon}</span><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join("")}
    </div>
    <div style="margin-top:8px"><div class="eyebrow">Levels follow the course</div><div class="h2" style="margin-top:4px">Dodger Stadium → Century City</div></div>
    <section class="card flush ladder"><div class="list">
      ${LEVELS.map(([need, name, tag], i) => `
        <div class="li ${i + 1 === lvl.n ? "cur" : i + 1 > lvl.n ? "locked" : ""}">
          <div class="ic" style="background:${i + 1 <= lvl.n ? "var(--sunset)" : "var(--surface-2)"};color:#1A0B22;font-weight:900">${i + 1}</div>
          <div class="grow"><div class="title">${esc(name)} ${i + 1 === lvl.n ? "📍" : ""}</div><div class="sub">${esc(tag)}</div></div>
          <div class="right muted num" style="font-size:13px">${need.toLocaleString()} XP</div>
        </div>`).join("")}
    </div></section>
    <section class="card">
      <div class="h2" style="margin-bottom:8px">How to earn XP</div>
      <div class="muted" style="font-size:14px;line-height:1.7">
        +${XP.mile} per mile · +${XP.dayDone} for hitting a planned run<br/>
        +${XP.longBonus} long-run bonus · +${XP.qualityBonus} workout bonus<br/>
        +${XP.perfectWeek} for a ⭐⭐⭐ week · +${XP.checkpoint} per checkpoint<br/>
        +${XP.crossTrain} per cross-training day (bike, etc.)<br/>
        🔥 Streak = weeks in a row at ≥80% of planned miles
      </div>
    </section>`;
}

// ======================================================================
// Sheets
// ======================================================================
function openSheet(html) {
  const sheet = $("#sheet");
  sheet.innerHTML = `<div class="grabber"></div>${html}`;
  sheet.hidden = false;
  $("#sheet-backdrop").hidden = false;
}
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
}

function openWeek(n) {
  const w = weekStats(state).find((x) => x.week === n);
  const fit = fitness(state);
  openSheet(`
    <div class="row between"><div><div class="eyebrow">Week ${w.week} · ${esc(w.phase)}</div><div class="h2" style="font-size:20px">${esc(w.focus)}</div></div>
      <div class="right"><b class="num">${fmtMi(w.actual)} / ${fmtMi(w.planned)}</b><div class="muted" style="font-size:12px">miles</div></div></div>
    <div class="list" style="margin-top:12px">
      ${w.days.map((d, i) => `
        <div class="li" style="padding-left:0;padding-right:0">
          <div class="ic" style="background:${TYPE_COLOR[d.type]}22">${TYPE_ICON[d.type]}</div>
          <div class="grow"><div class="title">${DOW[i]} ${prettyDate(d.date, { month: "short", day: "numeric" })} · ${d.miles ? fmtMi(d.miles) + " mi" : "Rest"}</div>
            <div class="sub" style="white-space:normal">${esc(d.desc)}${targetPace(d.type, fit) ? ` · <b style="color:var(--text)">${targetPace(d.type, fit)}</b>` : ""}</div></div>
          <div class="right" style="font-size:18px">${{ done: "✅", partial: "🟡", missed: "❌", bonus: "⭐", today: "👉", rest: "", future: "" }[d.status]}</div>
        </div>`).join("")}
    </div>
    <button class="btn ghost" style="margin-top:12px" data-action="close">Close</button>`);
}

function openLog(run, preset) {
  const today = todayKey();
  const plan = PLAN_BY_DATE[today];
  const defaultType = plan && plan.miles ? plan.type : plan ? "Cross-train" : "Easy"; // rest day → bike
  const r = run || {
    date: preset?.date || today,
    type: preset?.type || defaultType,
    miles: preset?.miles ?? (plan && plan.miles ? plan.miles : ""),
    secs: null, hr: null, effort: defaultType === "Cross-train" ? 2 : 4, notes: "",
  };
  const cross0 = r.type === "Cross-train";
  const h = r.secs && !cross0 ? Math.floor(r.secs / 3600) : "", m = r.secs && !cross0 ? Math.floor((r.secs % 3600) / 60) : "", s = r.secs && !cross0 ? r.secs % 60 : "";
  openSheet(`
    <div class="h2" style="font-size:20px;margin-bottom:14px">${run ? "Edit" : "Log activity"}</div>
    <form id="log-form" style="display:flex;flex-direction:column;gap:14px">
      <div class="types" role="radiogroup">${LOG_TYPES.map((t) => `<button type="button" data-type="${t}" class="${t === r.type ? "on" : ""}">${TYPE_ICON[t]} ${t === "MP" ? "Marathon pace" : t}</button>`).join("")}</div>
      <div class="field"><label for="f-date">Date</label><input id="f-date" class="input" type="date" value="${r.date}" required /></div>
      <div id="run-fields" style="display:flex;flex-direction:column;gap:14px">
        <div class="field"><label for="f-miles">Miles</label><input id="f-miles" class="input num" type="number" inputmode="decimal" step="0.01" min="0" value="${cross0 ? "" : r.miles}" /></div>
        <div class="field"><label>Time (h : m : s)</label>
          <div class="row" style="gap:6px">
            <input id="f-h" class="input num" type="number" inputmode="numeric" min="0" placeholder="h" value="${h}" style="text-align:center" />
            <b>:</b><input id="f-m" class="input num" type="number" inputmode="numeric" min="0" max="59" placeholder="min" value="${m}" style="text-align:center" />
            <b>:</b><input id="f-s" class="input num" type="number" inputmode="numeric" min="0" max="59" placeholder="sec" value="${s}" style="text-align:center" />
          </div>
          <div class="pace-live" id="pace-live">Pace: <b>—</b></div>
        </div>
      </div>
      <div id="cross-fields" class="grid2">
        <div class="field"><label for="f-min">Minutes</label><input id="f-min" class="input num" type="number" inputmode="numeric" min="1" value="${cross0 && r.secs ? Math.round(r.secs / 60) : ""}" placeholder="30" /></div>
        <div class="field"><label for="f-hr">Avg HR</label><input id="f-hr" class="input num" type="number" inputmode="numeric" min="40" max="220" value="${r.hr ?? ""}" placeholder="bpm" /></div>
        <div class="pace-live" id="hr-live" style="grid-column:1/-1"></div>
      </div>
      <div class="field"><label for="f-effort">Effort · <span id="effort-lbl">${r.effort || 4} — ${EFFORT[r.effort || 4]}</span></label>
        <input id="f-effort" type="range" min="1" max="10" value="${r.effort || 4}" /></div>
      <div class="field"><label for="f-notes">Notes</label><input id="f-notes" class="input" placeholder="How did it feel? Route? Shoes?" value="${esc(r.notes)}" /></div>
      <button class="btn" type="submit">${run ? "Save changes" : "Save  🎉"}</button>
      ${run ? `<button class="btn danger" type="button" data-action="delete">Delete</button>` : ""}
    </form>`);

  let type = r.type;
  const form = $("#log-form");
  const isX = () => type === "Cross-train";
  const secsNow = () => (+$("#f-h").value || 0) * 3600 + (+$("#f-m").value || 0) * 60 + (+$("#f-s").value || 0);
  const update = () => {
    $("#run-fields").hidden = isX();
    $("#cross-fields").hidden = !isX();
    $("#run-fields").style.display = isX() ? "none" : "flex";
    $("#cross-fields").style.display = isX() ? "grid" : "none";
    $("#f-miles").required = !isX();
    $("#f-min").required = isX();
    const mi = parseFloat($("#f-miles").value), sec = secsNow();
    $("#pace-live").innerHTML = `Pace: <b>${mi > 0 && sec > 0 ? fmtPace(sec / mi) + " /mi" : "—"}</b>`;
    const hr = +$("#f-hr").value;
    $("#hr-live").innerHTML = !hr ? "Recovery band: <b>100–115 bpm</b> · +" + XP.crossTrain + " XP (once per day)"
      : hr <= 115 ? "✅ <b>In your recovery band</b> — true active flush"
      : "⚠️ <b>Above 115</b> — that's a workout, not recovery. Ease off next time.";
  };
  form.addEventListener("input", update);
  update();
  form.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
    type = b.dataset.type;
    form.querySelectorAll("[data-type]").forEach((x) => x.classList.toggle("on", x === b));
    update();
  }));
  $("#f-effort").addEventListener("input", (e) => { $("#effort-lbl").textContent = `${e.target.value} — ${EFFORT[e.target.value]}`; });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let entry;
    const base = { id: run?.id || `r${Date.now()}`, date: $("#f-date").value, type, effort: +$("#f-effort").value, notes: $("#f-notes").value.trim() };
    if (isX()) {
      const mins = parseFloat($("#f-min").value);
      if (!(mins > 0)) return;
      entry = { ...base, miles: 0, secs: Math.round(mins * 60), hr: +$("#f-hr").value || null };
    } else {
      const miles = parseFloat($("#f-miles").value);
      if (!(miles >= 0)) return;
      entry = { ...base, miles, secs: secsNow() || null, hr: null };
    }
    closeSheet();
    commit(() => {
      if (run) state.runs = state.runs.map((x) => (x.id === run.id ? entry : x));
      else state.runs.push(entry);
    });
  });
  form.querySelector("[data-action=delete]")?.addEventListener("click", () => {
    if (!confirm("Delete this entry?")) return;
    closeSheet();
    commit(() => { state.runs = state.runs.filter((x) => x.id !== run.id); });
  });
}

// ======================================================================
// Celebrations
// ======================================================================
function celebrate(queue) {
  const item = queue.shift();
  confetti();
  openSheet(`
    <div class="celebrate">
      <div class="em">${item.em}</div>
      <div class="h1 grad-text">${esc(item.title)}</div>
      <p class="muted">${esc(item.desc)}</p>
      <button class="btn" data-action="next-celebration" style="margin-top:10px">${queue.length ? "Next" : "Let's go"}</button>
    </div>`);
  $("#sheet [data-action=next-celebration]").addEventListener("click", () => {
    closeSheet();
    if (queue.length) celebrate(queue);
  });
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 1800);
}
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("#confetti"), ctx = c.getContext("2d");
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const colors = ["#FFB347", "#FF6B6B", "#C04CFD", "#FFD166", "#3DDC97", "#6CB4FF"];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -14 - 4,
    s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (++frame < 150) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

// ======================================================================
// Events
// ======================================================================
function bindView() {
  const view = $("#view");
  view.querySelector("[data-action=log-today]")?.addEventListener("click", () => openLog());
  view.querySelectorAll("[data-week]").forEach((b) => b.addEventListener("click", () => openWeek(+b.dataset.week)));
  view.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => openLog(state.runs.find((r) => r.id === b.dataset.run))));
  view.querySelectorAll("[data-cp]").forEach((inp) => inp.addEventListener("change", () => {
    const v = inp.value.trim();
    const secs = v ? parseDuration(v.includes(":") ? v : `${v}:00`) : null;
    if (v && !(secs > 600)) { toast("Use m:ss or h:mm:ss"); return; }
    commit(() => { state.checkpoints[inp.dataset.cp] = secs; });
  }));
  view.querySelectorAll("[data-setting]").forEach((inp) => inp.addEventListener("change", () => {
    const secs = parseDuration(inp.value);
    if (!(secs > 3600)) { toast("Use h:mm:ss"); return; }
    commit(() => { state[inp.dataset.setting] = secs; });
  }));
  view.querySelector("[data-action=export]")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `road-to-la-backup-${todayKey()}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  });
  view.querySelector("[data-action=import]")?.addEventListener("click", () => $("#import-file").click());
  $("#import-file")?.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.runs)) throw new Error();
      state = { ...structuredClone(DEFAULT_STATE), ...data };
      saveState(state); render(); toast("Backup restored");
    } catch { toast("That file isn't a valid backup"); }
  });
  const chart = view.querySelector(".chart-wrap");
  if (chart) {
    const tips = JSON.parse(chart.dataset.tips), tip = chart.querySelector(".chart-tip");
    const show = (e) => {
      const i = e.target.dataset?.tip; if (i == null) return;
      const [wk, start, p, a] = tips[i];
      const box = chart.getBoundingClientRect(), rb = e.target.getBoundingClientRect();
      tip.innerHTML = `<b>Week ${wk}</b> · ${start}<br/><span style="color:var(--planned)">■</span> Planned ${p} mi<br/>${a == null ? "" : `<span style="color:var(--actual)">■</span> Actual ${a} mi`}`;
      tip.style.left = `${Math.min(box.width - 70, Math.max(70, rb.left - box.left + rb.width / 2))}px`;
      tip.style.top = `${rb.top - box.top + 30}px`;
      tip.hidden = false;
    };
    chart.addEventListener("pointerover", show);
    chart.addEventListener("pointerdown", show);
    chart.addEventListener("pointerleave", () => { tip.hidden = true; });
  }
}

document.querySelectorAll(".tabbar button").forEach((b) => b.addEventListener("click", () => {
  tab = b.dataset.tab; render(); scrollTo(0, 0);
}));
$("#fab").addEventListener("click", () => openLog());
$("#sheet-backdrop").addEventListener("click", closeSheet);
$("#sheet").addEventListener("click", (e) => { if (e.target.closest("[data-action=close]")) closeSheet(); });

initRewards();
render();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
