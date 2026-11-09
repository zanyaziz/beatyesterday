"use client";

import { useState } from "react";
import {
  AppState,
  buildRecurring,
  dateStr,
  dayPoints,
  DEFAULT_ANSWERS,
  DEMO_MEMBERS,
  demoMinutes,
  demoPoints,
  fmtDur,
  lastNDates,
  prettyDate,
  ScheduleAnswers,
  Sharing,
} from "../lib/core";
import { LineChart } from "./visuals";

// ---------------- Spaces ----------------
export function SpacesTab({
  state,
  setState,
}: {
  state: AppState;
  setState: (s: AppState) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const today = dateStr(new Date());
  const dates14 = lastNDates(14);

  const rows = [
    { id: "you", name: `${state.name} (you)`, sharing: state.sharing, color: "#4f46e5", pts: dayPoints(state, today), isYou: true },
    ...DEMO_MEMBERS.map((m) => ({
      id: m.id,
      name: m.name,
      sharing: m.sharing,
      color: m.color,
      pts: demoPoints(m, state, today),
      isYou: false,
    })),
  ].sort((a, b) => b.pts - a.pts);

  const series = [
    { name: `${state.name} (you)`, color: "#4f46e5", values: dates14.map((d) => dayPoints(state, d)) },
    ...DEMO_MEMBERS.filter((m) => m.sharing !== "private").map((m) => ({
      name: m.name,
      color: m.color,
      values: dates14.map((d) => demoPoints(m, state, d)),
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="font-semibold text-slate-900">Your sharing level</h3>
        <p className="mb-3 text-sm text-slate-500">
          You control what other people in a Space can see. Only your totals are shared by default.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["detailed", "Full breakdown — categories, minutes & points"],
              ["totals", "Totals only — just your daily points"],
              ["private", "Private — hidden from the leaderboard"],
            ] as [Sharing, string][]
          ).map(([level, label]) => (
            <button
              key={level}
              onClick={() => setState({ ...state, sharing: level })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                state.sharing === level ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
              title={label}
            >
              {level === "detailed" ? "Full breakdown" : level === "totals" ? "Totals only" : "Private"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-1 font-semibold text-slate-900">Daily leaderboard — {prettyDate(today)}</h3>
        <p className="mb-3 text-xs text-slate-500">
          Demo Space “Morning Crew” · members below are clearly-labeled demo data.
        </p>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const member = DEMO_MEMBERS.find((m) => m.id === r.id);
            const hidden = r.sharing === "private";
            const mins = member ? demoMinutes(member, state, today) : null;
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="rounded-xl ring-1 ring-slate-200">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  disabled={hidden}
                >
                  <span className="w-6 text-center text-lg font-bold text-slate-400">#{i + 1}</span>
                  <span className="h-8 w-8 shrink-0 rounded-full text-center text-sm font-bold leading-8 text-white" style={{ backgroundColor: r.color }}>
                    {r.name[0]}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-slate-900">
                      {r.name} {member ? <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">DEMO</span> : null}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {r.sharing === "detailed" ? "shares full breakdown" : r.sharing === "totals" ? "shares totals only" : "private — hidden"}
                    </span>
                  </span>
                  {hidden ? (
                    <span className="text-sm font-medium text-slate-400">— hidden —</span>
                  ) : (
                    <span className="text-lg font-extrabold text-slate-900">{r.pts.toFixed(1)} pts</span>
                  )}
                  {!hidden && <span className="text-slate-400">{isOpen ? "▾" : "▸"}</span>}
                </button>
                {isOpen && !hidden && mins && (
                  <div className="border-t border-slate-100 px-4 py-2">
                    {state.categories
                      .filter((c) => (mins[c.id] || 0) > 0)
                      .sort((a, b) => (mins[b.id] || 0) - (mins[a.id] || 0))
                      .map((c) => (
                        <div key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                          <span className="flex-1 text-slate-700">{c.name}</span>
                          <span className="text-slate-500">{fmtDur(mins[c.id])}</span>
                          <span className="w-14 text-right font-semibold text-slate-800">
                            {(((c.pointsPerHour * mins[c.id]) / 60)).toFixed(1)} pts
                          </span>
                        </div>
                      ))}
                    {r.sharing === "totals" && (
                      <p className="py-1 text-xs text-slate-400">Breakdown hidden — this member shares totals only.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-1 font-semibold text-slate-900">14-day trends</h3>
        <p className="mb-2 text-xs text-slate-500">One line per member. Private members are never plotted.</p>
        <LineChart series={series} />
      </div>
    </div>
  );
}

// ---------------- Setup ----------------
export function SetupTab({
  state,
  setState,
}: {
  state: AppState;
  setState: (s: AppState) => void;
}) {
  const [answers, setAnswers] = useState<ScheduleAnswers>(DEFAULT_ANSWERS);
  const [saved, setSaved] = useState("");

  const setPoints = (id: string, v: number) =>
    setState({ ...state, categories: state.categories.map((c) => (c.id === id ? { ...c, pointsPerHour: v } : c)) });

  const regenerate = () => {
    setState({ ...state, recurring: buildRecurring(answers) });
    setSaved("Schedule regenerated from your answers — day history is preserved.");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beatyesterday-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    if (confirm("Reset everything and start onboarding again? This clears local data in this browser.")) {
      localStorage.removeItem("beatyesterday-v1");
      location.reload();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Profile</h3>
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <input
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <p className="mt-2 text-sm text-slate-500">
          Points budget: {state.budget.three} × 3-point slots, {state.budget.two} × 2-point slots.
          Change the budget by re-running onboarding (reset below) — or just edit points here.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Points per hour</h3>
        <div className="space-y-2">
          {state.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="w-28 text-sm font-medium text-slate-800">{c.name}</span>
              <select
                value={c.pointsPerHour}
                onChange={(e) => setPoints(c.id, Number(e.target.value))}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {[3, 2, 1, 0, -0.5, -1].map((v) => (
                  <option key={v} value={v}>{v} pts/hr</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Changing points re-scores all days (past and future) — history is preserved, points are recomputed.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Regenerate recurring schedule</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Bedtime
            <input type="time" value={answers.bedtime} onChange={(e) => setAnswers({ ...answers, bedtime: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Wake up
            <input type="time" value={answers.wake} onChange={(e) => setAnswers({ ...answers, wake: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Leave for work
            <input type="time" value={answers.leave} onChange={(e) => setAnswers({ ...answers, leave: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Work ends
            <input type="time" value={answers.workEnd} onChange={(e) => setAnswers({ ...answers, workEnd: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Workout time
            <input type="time" value={answers.workoutTime} onChange={(e) => setAnswers({ ...answers, workoutTime: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Workout length (min)
            <input type="number" min={10} max={180} step={5} value={answers.workoutMin} onChange={(e) => setAnswers({ ...answers, workoutMin: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <button onClick={regenerate} className="mt-3 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          Regenerate schedule
        </button>
        {saved && <p className="mt-2 text-sm text-emerald-700">{saved}</p>}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Calendar</h3>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={state.calendarSimulated}
            onChange={(e) => setState({ ...state, calendarSimulated: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span className="text-sm text-slate-700">
            Google Calendar sync (SIMULATED — prototype only, no real OAuth in v1)
          </span>
        </label>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Your data</h3>
        <p className="mb-3 text-sm text-slate-500">
          v1 stores everything in this browser&apos;s localStorage. No account, no server. Export a
          backup anytime.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300">
            Export my data (JSON)
          </button>
          <button onClick={resetAll} className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            Reset &amp; restart onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
