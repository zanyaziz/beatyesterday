"use client";

import { useState } from "react";
import {
  addDays,
  AppState,
  blocksOf,
  dateStr,
  dayMinutes,
  dayPoints,
  dayStatus,
  fmtDur,
  fmtMin,
  prettyDate,
} from "../lib/core";
import { RhythmClock, Treemap, Waffle } from "./visuals";

export default function TodayTab({
  state,
  setState,
}: {
  state: AppState;
  setState: (s: AppState) => void;
}) {
  const [date, setDate] = useState(dateStr(new Date()));
  const [isolated, setIsolated] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, number> | null>(null);

  const minutes = dayMinutes(state, date);
  const status = dayStatus(state, date);
  const pts = dayPoints(state, date);
  const yday = dayPoints(state, dateStr(addDays(new Date(date + "T12:00:00"), -1)));
  const diff = pts - yday;
  const totalMin = Object.values(minutes).reduce((s, m) => s + m, 0);

  const startEdit = () => setEditing({ ...minutes });
  const bump = (id: string, d: number) =>
    setEditing((e) => (e ? { ...e, [id]: Math.max(0, (e[id] || 0) + d) } : e));
  const confirmDay = (adjusted: boolean) => {
    const mins = editing ?? minutes;
    // Rebalance Free Time so the day still totals 1440
    const total = Object.values(mins).reduce((s, m) => s + m, 0);
    const fixed = { ...mins, free: Math.max(0, (mins["free"] || 0) + (1440 - total)) };
    setState({
      ...state,
      days: {
        ...state.days,
        [date]: { date, status: adjusted ? "adjusted" : "confirmed", minutes: fixed },
      },
    });
    setEditing(null);
  };

  const shown = editing ?? minutes;
  const shownPts =
    (Object.entries(shown).reduce((s, [id, m]) => {
      const c = state.categories.find((x) => x.id === id);
      return s + ((c?.pointsPerHour ?? 0) * m) / 60;
    }, 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setDate(dateStr(addDays(new Date(date + "T12:00:00"), -1)))}
          className="rounded-full bg-white px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-slate-200"
        >
          ← Prev
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-900">{prettyDate(date)}</h2>
          <p className="text-xs text-slate-500">
            {status === "assumed" ? "Assumed from your schedule — not yet confirmed" : status === "confirmed" ? "✓ Confirmed — you stuck to the plan" : "✓ Confirmed with adjustments"}
          </p>
        </div>
        <button
          onClick={() => setDate(dateStr(addDays(new Date(date + "T12:00:00"), 1)))}
          className="rounded-full bg-white px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-slate-200"
        >
          Next →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-indigo-600 p-4 text-white shadow-sm">
          <div className="text-3xl font-extrabold">{pts.toFixed(1)}</div>
          <div className="text-xs opacity-80">points today</div>
        </div>
        <div className={`rounded-2xl p-4 shadow-sm ring-1 ring-slate-200 ${diff >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
          <div className={`text-3xl font-extrabold ${diff >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
          </div>
          <div className="text-xs text-slate-600">vs yesterday ({yday.toFixed(1)})</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="text-3xl font-extrabold text-slate-900">{blocksOf(totalMin).toFixed(1)}</div>
          <div className="text-xs text-slate-500">of 144 blocks tracked</div>
        </div>
      </div>

      {diff >= 0 && pts > 0 ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800">
          🎉 You&apos;re beating yesterday by {diff.toFixed(1)} points — keep it up!
        </p>
      ) : (
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-center text-sm text-slate-600">
          {Math.abs(diff).toFixed(1)} points behind yesterday. There&apos;s still time in the day — a 45-min workout is worth 2.3 pts.
        </p>
      )}

      <Waffle minutes={shown} categories={state.categories} isolated={isolated} onIsolate={setIsolated} />

      <div className="grid gap-4 md:grid-cols-2">
        <RhythmClock minutes={shown} categories={state.categories} recurring={state.recurring} date={date} isolated={isolated} />
        <Treemap minutes={shown} categories={state.categories} targetMinutes={minutes} isolated={isolated} />
      </div>

      {/* Schedule timeline */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-2 font-semibold text-slate-900">Schedule timeline</h3>
        <div className="space-y-1">
          {state.recurring
            .filter((r) => r.weekday === new Date(date + "T12:00:00").getDay())
            .sort((a, b) => a.startMin - b.startMin)
            .map((r) => {
              const c = state.categories.find((x) => x.id === r.categoryId);
              if (!c) return null;
              return (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 text-slate-500">{fmtMin(r.startMin)} – {fmtMin(r.endMin)}</span>
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="ml-auto text-slate-500">{fmtDur(r.endMin - r.startMin)} · {blocksOf(r.endMin - r.startMin).toFixed(1)} blocks</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* End-of-day check-in */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="font-semibold text-slate-900">End-of-day check-in</h3>
        <p className="mb-3 text-sm text-slate-500">
          Did you stick to your schedule today? Adjust in 10-minute blocks, then confirm. If you
          don&apos;t confirm, we&apos;ll assume you did.
        </p>
        {editing === null ? (
          <button onClick={startEdit} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
            Check in for today
          </button>
        ) : (
          <div className="space-y-2">
            {state.categories
              .filter((c) => (shown[c.id] || 0) > 0 || c.id === "exercise")
              .map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="w-28 font-medium text-slate-800">{c.name}</span>
                  <button onClick={() => bump(c.id, -10)} className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">−10</button>
                  <span className="w-20 text-center text-slate-700">
                    {fmtDur(shown[c.id] || 0)} · {blocksOf(shown[c.id] || 0).toFixed(1)} blk
                  </span>
                  <button onClick={() => bump(c.id, 10)} className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">+10</button>
                  <span className="ml-auto font-semibold text-slate-900">
                    {(((c.pointsPerHour * (shown[c.id] || 0)) / 60)).toFixed(1)} pts
                  </span>
                </div>
              ))}
            <p className="pt-1 text-sm text-slate-600">
              Adjusted total: <b>{shownPts.toFixed(1)} pts</b> (was {pts.toFixed(1)})
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => confirmDay(false)} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white">
                ✓ Yes — I stuck to my schedule
              </button>
              <button onClick={() => confirmDay(true)} className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white">
                Confirm with adjustments
              </button>
              <button onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
