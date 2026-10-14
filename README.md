# Road to LA 🌅

A gamified training app (PWA) for the **LA Marathon — Sunday, March 7, 2027**. Goal: sub-4.

21-week plan (Oct 12, 2026 → race day) with XP, levels named after the course
(Dodger Stadium → Century City), weekly stars, streaks, and badges.

## Run locally

```bash
python3 -m http.server 8127
```

Then open http://localhost:8127.

## Files

| File | What it does |
|---|---|
| `plan.js` | Training plan, pace model (Riegel), XP / levels / badges logic |
| `app.js` | UI: Today, Journey, Runs, Stats, Trophies |
| `styles.css` | Styles |
| `sw.js` | Service worker (offline support) |
| `manifest.webmanifest` | Makes it installable ("Add to Home Screen") |

Run data is stored in the browser's `localStorage` on each device. Use **Stats → Export backup** to save a copy.
