"use client";

import { useMemo, useState } from "react";
import {
  AppState,
  buildRecurring,
  DEFAULT_ANSWERS,
  minutesFromRecurring,
  ScheduleAnswers,
  scoreMinutes,
  seedHistory,
} from "../lib/core";

const CATEGORIES_EDITABLE = [
  "sleep",
  "family",
  "learning",
  "exercise",
  "focus",
  "work",
  "chores",
  "commute",
  "social",
];

export default function Onboarding({ onDone }: { onDone: (s: AppState) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [three, setThree] = useState(4);
  const [two, setTwo] = useState(1);
  const [points, setPoints] = useState<Record<string, number>>({
    sleep: 3,
    family: 3,
    learning: 3,
    exercise: 3,
    focus: 2,
    work: 1,
    chores: 1,
    commute: 1,
    social: -0.5,
  });
  const [answers, setAnswers] = useState<ScheduleAnswers>(DEFAULT_ANSWERS);
  const [calendarSim, setCalendarSim] = useState(false);

  const setA = (patch: Partial<ScheduleAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const toggleDay = (d: number) =>
    setA({
      workoutDays: answers.workoutDays.includes(d)
        ? answers.workoutDays.filter((x) => x !== d)
        : [...answers.workoutDays, d].sort(),
    });

  const threeCount = Object.values(points).filter((p) => p === 3).length;
  const twoCount = Object.values(points).filter((p) => p === 2).length;
  const budgetOk = threeCount <= three && twoCount <= two;

  const preview = useMemo(() => {
    const recurring = buildRecurring(answers);
    const wd = minutesFromRecurring(recurring, "2026-11-09"); // Monday
    const we = minutesFromRecurring(recurring, "2026-11-08"); // Sunday
    const cats = CATEGORIES_EDITABLE.map((id) => ({
      id,
      name: id,
      color: "#000",
      pointsPerHour: points[id] ?? 1,
    }));
    return {
      weekday: scoreMinutes(wd, cats as never),
      weekend: scoreMinutes(we, cats as never),
      recurring,
    };
  }, [answers, points]);

  const finish = () => {
    const recurring = buildRecurring(answers);
    const cats = [
      { id: "sleep", name: "Sleep", color: "#6366f1", pointsPerHour: points.sleep },
      { id: "family", name: "Family", color: "#f59e0b", pointsPerHour: points.family },
      { id: "learning", name: "Learning", color: "#10b981", pointsPerHour: points.learning },
      { id: "exercise", name: "Exercise", color: "#ef4444", pointsPerHour: points.exercise },
      { id: "focus", name: "Deep Focus", color: "#8b5cf6", pointsPerHour: points.focus },
      { id: "work", name: "Work", color: "#3b82f6", pointsPerHour: points.work },
      { id: "chores", name: "Chores", color: "#84cc16", pointsPerHour: points.chores },
      { id: "commute", name: "Commute", color: "#06b6d4", pointsPerHour: points.commute },
      { id: "free", name: "Free Time", color: "#9ca3af", pointsPerHour: 1 },
      { id: "social", name: "Social Media", color: "#ec4899", pointsPerHour: points.social },
    ];
    const state: AppState = {
      onboarded: true,
      name: name.trim() || "You",
      budget: { three, two },
      categories: cats,
      recurring,
      calendarSimulated: calendarSim,
      sharing: "totals",
      days: {},
      goals: [],
      createdAt: new Date().toISOString(),
    };
    state.days = seedHistory(state);
    onDone(state);
  };

  const steps = ["Welcome", "Points budget", "Your schedule", "Calendar", "Review"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="text-4xl">⏱️</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Beat Yesterday</h1>
        <p className="mt-1 text-slate-500">Beat yesterday. Your day is 144 blocks of 10 minutes — spend them well.</p>
      </div>

      <div className="mb-6 flex justify-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                i === step ? "bg-indigo-600 text-white" : i < step ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="h-0.5 w-6 bg-slate-200" />}
          </div>
        ))}
      </div>
      <p className="mb-4 text-center text-sm font-medium text-slate-600">
        Step {step + 1} of 5 — {steps[step]}
      </p>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-slate-700">
              Every day has <b>1,440 minutes = 144 blocks of 10 minutes</b>. You assign points to
              what each block is worth — sleep, family, learning and exercise are usually worth
              the most — and your day scores itself from your schedule and calendar.
            </p>
            <p className="text-slate-700">
              Tomorrow, you try to <b>beat yesterday&apos;s score</b>. That&apos;s the whole game.
            </p>
            <label className="block text-sm font-medium text-slate-700">
              What should we call you?
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zain"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Everyone gets a limited number of high-value slots — that&apos;s what makes the
              trade-offs real. Pick your budget, then assign points per hour to each category.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">
                3-point slots
                <select
                  value={three}
                  onChange={(e) => setThree(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} categories at 3 pts/hr</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                2-point slots
                <select
                  value={two}
                  onChange={(e) => setTwo(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n} categor{n === 1 ? "y" : "ies"} at 2 pts/hr</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              {CATEGORIES_EDITABLE.map((id) => (
                <div key={id} className="flex items-center gap-3">
                  <span className="w-28 text-sm font-medium capitalize text-slate-800">{id === "focus" ? "Deep Focus" : id === "social" ? "Social Media" : id}</span>
                  <select
                    value={points[id]}
                    onChange={(e) => setPoints((p) => ({ ...p, [id]: Number(e.target.value) }))}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {[3, 2, 1, 0, -0.5, -1].map((v) => (
                      <option key={v} value={v}>{v > 0 ? `${v} pts/hr` : v === 0 ? "0 pts/hr" : `${v} pts/hr (costs you)`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className={`text-sm ${budgetOk ? "text-slate-500" : "font-medium text-rose-600"}`}>
              Using {threeCount} of {three} 3-point slots · {twoCount} of {two} 2-point slots
              {!budgetOk && " — over budget! Lower some categories to continue."}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Your recurring schedule drafts itself from a few answers. You can fine-tune every
              block later in Setup.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">
                Bedtime
                <input type="time" value={answers.bedtime} onChange={(e) => setA({ bedtime: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Wake up
                <input type="time" value={answers.wake} onChange={(e) => setA({ wake: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Leave for work
                <input type="time" value={answers.leave} onChange={(e) => setA({ leave: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Commute (min each way)
                <input type="number" min={0} max={120} value={answers.commuteMin} onChange={(e) => setA({ commuteMin: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Work starts
                <input type="time" value={answers.workStart} onChange={(e) => setA({ workStart: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Work ends
                <input type="time" value={answers.workEnd} onChange={(e) => setA({ workEnd: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Workout time
                <input type="time" value={answers.workoutTime} onChange={(e) => setA({ workoutTime: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Workout length (min)
                <input type="number" min={10} max={180} step={5} value={answers.workoutMin} onChange={(e) => setA({ workoutMin: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Workout days</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(i)}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      answers.workoutDays.includes(i) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <b>SIMULATED / prototype:</b> real Google Calendar OAuth sync is not in v1. Turning
              this on marks calendar events as “synced” from your recurring schedule in the demo —
              no real Google account is connected.
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <input type="checkbox" checked={calendarSim} onChange={(e) => setCalendarSim(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                <span className="block font-medium text-slate-800">Connect Google Calendar (simulated)</span>
                <span className="text-sm text-slate-500">
                  Calendar events would map to categories by title keywords, and fill your day
                  automatically. In v1 this is a placeholder toggle.
                </span>
              </span>
            </label>
            <p className="text-sm text-slate-500">
              Phone calendar import (via .ics) and real Google OAuth are planned next steps —
              see the README.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-slate-700">
              Here&apos;s what a day looks like with your setup, scored straight from your
              recurring schedule:
            </p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-indigo-50 p-4">
                <div className="text-2xl font-extrabold text-indigo-700">{preview.weekday.toFixed(1)}</div>
                <div className="text-xs text-slate-600">points on a weekday</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="text-2xl font-extrabold text-emerald-700">{preview.weekend.toFixed(1)}</div>
                <div className="text-xs text-slate-600">points on a weekend day</div>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Example: 8 hours of sleep at 3 pts/hr = 24 points. A 45-minute workout at 3 pts/hr
              = 2.3 points, or 4.5 blocks of your 144.
            </p>
            <p className="text-sm text-slate-500">
              Days auto-score from this schedule. If you don&apos;t confirm a day in the evening,
              we assume you stuck to it.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
        >
          ← Back
        </button>
        {step < 4 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 1 && !budgetOk}
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Continue →
          </button>
        ) : (
          <button onClick={finish} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
            Start beating yesterday →
          </button>
        )}
      </div>
    </div>
  );
}
