# Beat Yesterday

**Beat yesterday.** Your day is 144 blocks of 10 minutes. Score them, beat
yesterday, and do it again tomorrow.

A day = 1,440 minutes = 144 blocks. You assign points per 10-minute block —
Sleep, Family, Learning and Exercise are usually 3 pointers, Deep Focus 2,
Work / Chores / Commute 1, Social Media −0.5. Your day scores itself from
your recurring schedule and calendar, you confirm it in the evening, and
tomorrow you try to beat it.

## Screens

- **Landing** — everyone lands here first: hero, a real sample day scored
  by the points engine (144-block waffle + score card), a "How it works"
  section, and a points explainer, with a CTA into onboarding.
- **Onboarding (5 steps)** — points budget (limited 3- and 2-pointer slots),
  points-per-block editor, sleep/wake/commute/workout questions that draft a
  recurring schedule, and Google Calendar connect / .ics import. The
  in-progress draft is saved to localStorage, so the Google sign-in redirect
  doesn't lose your answers.
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

`points = points_per_block × minutes / 10`

Example: 8 hours of sleep at 3 pts/block = 144 points. A 45-minute workout at
3 pts/block = 13.5 points (4.5 blocks). A weekday on the default schedule
scores 274.5 points; a weekend day scores 295.5 points.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

```bash
npm run build   # production build check
```

## Environment variables

None are required — without them the app runs entirely on localStorage
(per browser) with a clearly-labeled simulated calendar toggle.

| Variable | Required for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth + cloud sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth + cloud sync |

Set them in Vercel (Project → Settings → Environment Variables) and
redeploy. See `SUPABASE_SETUP.md` for the full dashboard checklist.

## Supabase sync + Google Calendar

- **Sync (`lib/supabase.ts`)** — when the env vars are set, signing in
  (Google) loads your state from Supabase if it exists, otherwise migrates
  your local state up once. Every change then syncs back (debounced 1s):
  categories, point budget, recurring schedule, day blocks, goals. If any
  call fails, the header shows the error and localStorage keeps working.
  The schema (`supabase/schema.sql`) has row-level security — users can only
  read/write their own rows — plus a trigger that creates a profile row on
  signup.
- **Google Calendar (`lib/calendar.ts`)** — Sign in with Google requests the
  `calendar.readonly` scope. "Import last 7 days" fetches your primary
  calendar, maps each event to a category by title keywords (gym → Exercise,
  focus → Deep Focus, …), and buckets the minutes into 10-minute blocks on
  the right day, taking minutes from Free Time first. Imported days are
  marked "adjusted". Events that match no keyword go to Free Time and are
  listed in the import summary. All-day events are skipped (they carry no
  minutes).
- **Phone calendar (.ics)** — works with no account at all: export an .ics
  from Apple Calendar or Google Calendar and upload it in Onboarding step 3
  or Setup → Calendar. Same keyword mapping and block bucketing.

## Deploy

Deploy on Vercel:

- Import the repo at https://vercel.com/new (framework preset: Next.js), or
- `vercel` from the repo root with the Vercel CLI.

Every push to `main` redeploys automatically when the repo is linked.

## What's real vs simulated

- **Real:** landing + onboarding, points engine, 144-block visualizations,
  trends, insights, badges, goals, Spaces leaderboard + privacy, localStorage
  persistence (per browser), .ics import, Supabase sync + Google Calendar
  import (once the env vars and dashboard setup from `SUPABASE_SETUP.md`
  are done).
- **Simulated / prototype:** Google Calendar sync is a clearly-labeled
  toggle when Supabase is not configured — no real OAuth, no Google account
  is connected. Space members (Riley, Jordan, Taylor, Casey) are
  clearly-labeled demo data so the leaderboard and privacy controls can be
  tried end to end.
- **Not yet:** domain (beatyesterday.ai is not registered yet), real
  multi-user Spaces (members are still demo data; the schema + RLS for real
  spaces is ready).

## Next steps

1. **Dashboard setup** — follow `SUPABASE_SETUP.md` (Supabase project,
   run the schema, enable Google Auth, add the env vars in Vercel).
2. **Domain** — register `beatyesterday.ai` and attach it in Vercel.
3. **Real Spaces** — invites + sharing real member totals via
   `space_day_totals` (schema + RLS already in place).

## Tech

Next.js (App Router, TypeScript), Tailwind CSS v4, React 19. Zero runtime
dependencies beyond Next/React.
