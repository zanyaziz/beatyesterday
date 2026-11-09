// Beat Yesterday — landing screen. EVERYONE lands here first.
// Explains the app, shows a real sample day scored by the actual points
// engine (default schedule + seeded history — nothing hardcoded), then
// hands off to onboarding.

"use client";

import { useMemo, useState } from "react";
import {
  AppState,
  dayMinutes,
  dayPoints,
  defaultState,
  fmtPts,
  lastNDates,
  prettyDate,
  seedHistory,
} from "../lib/core";
import { Waffle } from "./visuals";

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "Assign points per block",
    body: "Your day is 144 blocks of 10 minutes. Give each block a value — Sleep, Family, Learning and Exercise are usually 3 points, Deep Focus 2, the rest 1. Social media costs you −0.5 a block. You only get a few 3-point slots, so the trade-offs are real.",
  },
  {
    n: "2",
    title: "Your schedule scores the day",
    body: "Answer a few questions — when you sleep, wake, commute and work out — and your recurring schedule drafts itself. Connect Google Calendar (or import an .ics from your phone) and real events score your day too.",
  },
  {
    n: "3",
    title: "Confirm in the evening",
    body: "At the end of the day, confirm you stuck to the plan — or adjust in 10-minute blocks. Don't confirm? We assume you did. Tomorrow, one job: beat yesterday's score.",
  },
];

export default function Landing({ onStart }: { onStart: () => void }) {
  const [isolated, setIsolated] = useState<string | null>(null);

  // Real sample day, scored by the engine: default schedule + seeded
  // history, best day of the last 7 (so the sample is a day worth beating).
  const sample = useMemo(() => {
    const s: AppState = defaultState();
    s.days = seedHistory(s);
    const dates = lastNDates(7);
    let best = dates[0];
    for (const d of dates) {
      if (dayPoints(s, d) > dayPoints(s, best)) best = d;
    }
    const avg7 = dates.reduce((t, d) => t + dayPoints(s, d), 0) / dates.length;
    return {
      state: s,
      date: best,
      minutes: dayMinutes(s, best),
      points: dayPoints(s, best),
      avg7,
    };
  }, []);

  const scrollToSample = () => {
    document.getElementById("sample-day")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Hero */}
      <div className="text-center">
        <div className="text-5xl">⏱️</div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Beat Yesterday
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
          Your day is 144 blocks of 10 minutes. Spend them well.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Give every block a point value, let your schedule and calendar score
          the day, and wake up tomorrow with one job: beat yesterday.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={onStart}
            className="rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm"
          >
            Start beating yesterday →
          </button>
          <button
            onClick={scrollToSample}
            className="rounded-full bg-white px-6 py-3 text-base font-semibold text-slate-700 ring-1 ring-slate-300"
          >
            See a sample day
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Free to try · your data stays in your browser until you connect Supabase
        </p>
      </div>

      {/* Sample day */}
      <div id="sample-day" className="mt-10 scroll-mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm">
            <div className="text-3xl font-extrabold">{fmtPts(sample.points)}</div>
            <div className="text-xs opacity-80">points · sample day ({prettyDate(sample.date)})</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="text-3xl font-extrabold text-slate-900">{fmtPts(sample.avg7)}</div>
            <div className="text-xs text-slate-500">avg points / day (last 7 days)</div>
          </div>
        </div>
        <Waffle
          minutes={sample.minutes}
          categories={sample.state.categories}
          isolated={isolated}
          onIsolate={setIsolated}
        />
        <p className="text-center text-xs text-slate-500">
          A real sample day, scored by the same engine you&apos;ll use — tap a
          category above to isolate it. 8 hours of sleep at 3 pts/block is 144
          points; a 45-minute workout is 13.5.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-10">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">How it works</h2>
        <div className="mt-4 space-y-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-base font-bold text-white">
                {s.n}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Points explainer */}
      <div className="mt-10 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-center text-xl font-extrabold text-slate-900">What a block is worth</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 rounded-full bg-indigo-100 px-2 py-1 text-center text-xs font-bold text-indigo-700">3 pts</span>
            <span className="text-slate-700">Sleep · Family · Learning · Exercise — the things that make a day great</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 rounded-full bg-violet-100 px-2 py-1 text-center text-xs font-bold text-violet-700">2 pts</span>
            <span className="text-slate-700">Deep Focus — protected, uninterrupted work</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 rounded-full bg-slate-100 px-2 py-1 text-center text-xs font-bold text-slate-700">1 pt</span>
            <span className="text-slate-700">Work · Chores · Commute · Free Time — it all counts, just less</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 rounded-full bg-rose-100 px-2 py-1 text-center text-xs font-bold text-rose-700">−0.5 pts</span>
            <span className="text-slate-700">Social Media — every block scrolling costs you</span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          A weekday on the default schedule scores 274.5 points; a weekend day 295.5.
          Your numbers will be yours — set them in onboarding.
        </p>
      </div>

      {/* Closing CTA */}
      <div className="mt-10 text-center">
        <button
          onClick={onStart}
          className="rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm"
        >
          Start beating yesterday →
        </button>
        <p className="mt-2 text-xs text-slate-400">Takes about 2 minutes to set up.</p>
      </div>
    </div>
  );
}
