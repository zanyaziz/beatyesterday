# Beat Yesterday

**Beat yesterday.** Your day is 144 blocks of 10 minutes. Score them, beat
yesterday, and do it again tomorrow.

A day = 1,440 minutes = 144 blocks. You assign points per hour to what each
block is worth — Sleep, Family, Learning and Exercise are usually 3 pointers,
Deep Focus 2, Work / Chores / Commute 1, Social Media −0.5. Your day scores
itself from your recurring schedule and calendar, you confirm it in the
evening, and tomorrow you try to beat it.

## Screens

- **Onboarding (5 steps)** — points budget (limited 3- and 2-pointer slots),
  points-per-hour editor, sleep/wake/commute/workout questions that draft a
  recurring schedule, and a Google Calendar toggle.
- **Today** — day score vs yesterday, 144-block waffle (Minutes | Points
  toggle; Points mode re-sorts by value, negative categories are dashed debt
  blocks), 24-hour rhythm clock, Time Portfolio treemap with Target vs
  Actual, schedule timeline, and end-of-day check-in in 10-minute steps.
  A 45-minute workout is exactly 4.5 blocks everywhere.
- **Trends** — preset (7/14/30 days) and custom date ranges, daily bars
  (confirmed vs assumed), weekly totals, category drift, and a "Week in
  blocks" strip (one 144-block row per day).
- **Insights** — computed stats, badges (Well Rested, Daily Mover, Curious
  Mind, Deep Worker, Low Scroll, Rising), data-driven suggestions, and goals
  with live progress.
- **Spaces** — privacy controls (full breakdown / totals only / private),
  daily leaderboard against clearly-labeled demo members, expandable
  breakdowns where shared, and a 14-day multi-line trend chart. A private
  member's numbers are fully hidden.
- **Setup** — re-edit points, regenerate the recurring schedule, and export
  or reset your data. Day history is preserved when you change points.

## Points math

`points = points_per_hour × minutes / 60`

Example: 8 hours of sleep at 3 pts/hr = 24 points.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

```bash
npm run build   # production build check
```

## Deploy

No environment variables are required for v1. Deploy on Vercel:

- Import the repo at https://vercel.com/new (framework preset: Next.js), or
- `vercel` from the repo root with the Vercel CLI.

Every push to `main` redeploys automatically when the repo is linked.

## What's real vs simulated in v1

- **Real:** onboarding, points engine, 144-block visualizations, trends,
  insights, badges, goals, Spaces leaderboard + privacy, localStorage
  persistence (per browser).
- **Simulated / prototype:** Google Calendar sync is a clearly-labeled
  toggle — no real OAuth, no Google account is connected. Space members
  (Maya, Dev, Priya, Sam) are clearly-labeled demo data so the leaderboard
  and privacy controls can be tried end to end.
- **Not in v1:** accounts, cross-device sync, real calendar, domain
  (beatyesterday.ai is not registered yet).

## Next steps

1. **Supabase** — the full production schema is in `supabase/schema.sql`
   (profiles, categories, point_budgets, recurring_blocks, day_blocks,
   day_summaries, calendar_connections, calendar_events, goals, spaces,
   space_members, space_day_totals, badges, user_badges). It mirrors the
   v1 localStorage model 1:1, so the data layer can be swapped without
   changing the screens. Add Supabase Auth + row-level security so Spaces
   privacy is enforced server-side, not just in the UI.
2. **Google OAuth** — Sign in with Google, `calendar.readonly` scope, map
   events to categories by title keywords with a manual fallback, and write
   them into `day_blocks` (source = `calendar`).
3. **Domain** — register `beatyesterday.ai` and attach it in Vercel.
4. **Phone calendar** — `.ics` import or a native app; deferred after
   Google Calendar.

## Tech

Next.js (App Router, TypeScript), Tailwind CSS v4, React 19. Zero runtime
dependencies beyond Next/React.
