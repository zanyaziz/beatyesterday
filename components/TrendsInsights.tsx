"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  AppState,
  BADGES,
  blocksOf,
  dateStr,
  dayMinutes,
  dayPoints,
  dayStatus,
  fmtDur,
  lastNDates,
  prettyDate,
} from "../lib/core";

// ---------------- Trends ----------------
export function TrendsTab({ state }: { state: AppState }) {
  const [range, setRange] = useState<7 | 14 | 30 | "custom">(14);
  const [customStart, setCustomStart] = useState(dateStr(addDays(new Date(), -13)));
  const [customEnd, setCustomEnd] = useState(dateStr(new Date()));

  const dates = useMemo(() => {
    if (range === "custom") {
      const out: string[] = [];
      let d = new Date(customStart + "T12:00:00");
      const end = new Date(customEnd + "T12:00:00");
      while (d <= end && out.length < 60) {
        out.push(dateStr(d));
        d = addDays(d, 1);
      }
      return out;
    }
    return lastNDates(range);
  }, [range, customStart, customEnd]);

  const points = dates.map((d) => dayPoints(state, d));
  const max = Math.max(1, ...points);
  const total = points.reduce((s, v) => s + v, 0);
  const avg = points.length ? total / points.length : 0;

  // Weekly totals (last 7 vs prior 7)
  const last7 = lastNDates(7).reduce((s, d) => s + dayPoints(state, d), 0);
  const prior7 = lastNDates(14).slice(0, 7).reduce((s, d) => s + dayPoints(state, d), 0);

  // Category drift: this week avg vs prior week avg
  const drift = state.categories.map((c) => {
    const avgMin = (ds: string[]) =>
      ds.reduce((s, d) => s + (dayMinutes(state, d)[c.id] || 0), 0) / Math.max(1, ds.length);
    return { cat: c, now: avgMin(lastNDates(7)), before: avgMin(lastNDates(14).slice(0, 7)) };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([7, 14, 30] as const).map((n) => (
          <button
            key={n}
            onClick={() => setRange(n)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${range === n ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            Last {n} days
          </button>
        ))}
        <button
          onClick={() => setRange("custom")}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${range === "custom" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
        >
          Custom range
        </button>
      </div>
      {range === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label>From <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1" /></label>
          <label>To <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1" /></label>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="text-2xl font-extrabold text-slate-900">{total.toFixed(0)}</div>
          <div className="text-xs text-slate-500">points in range</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="text-2xl font-extrabold text-slate-900">{avg.toFixed(1)}</div>
          <div className="text-xs text-slate-500">avg points / day</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className={`text-2xl font-extrabold ${last7 - prior7 >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {last7 - prior7 >= 0 ? "+" : ""}{(last7 - prior7).toFixed(0)}
          </div>
          <div className="text-xs text-slate-500">pts this week vs last</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Daily points</h3>
        <div className="flex items-end gap-1" style={{ height: 140 }}>
          {dates.map((d, i) => (
            <div key={d} className="group relative flex-1" title={`${prettyDate(d)}: ${points[i].toFixed(1)} pts (${dayStatus(state, d)})`}>
              <div
                className={`w-full rounded-t ${dayStatus(state, d) === "assumed" ? "bg-indigo-300" : "bg-indigo-600"}`}
                style={{ height: `${Math.max(4, (points[i] / max) * 130)}px` }}
              />
              <div className="mt-1 text-center text-[9px] text-slate-400">{new Date(d + "T12:00:00").getDate()}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600 align-middle" /> Confirmed/adjusted &nbsp;
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-300 align-middle" /> Assumed from schedule
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Week in blocks</h3>
        <p className="mb-2 text-xs text-slate-500">One 144-block row per day — your whole week at a glance.</p>
        <div className="space-y-1.5">
          {lastNDates(7).map((d) => {
            const mins = dayMinutes(state, d);
            const totalPts = Math.max(0.1, dayPoints(state, d));
            return (
              <div key={d} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs font-medium text-slate-600">{prettyDate(d).split(",")[0]}</span>
                <div className="flex h-4 flex-1 overflow-hidden rounded">
                  {state.categories
                    .filter((c) => (mins[c.id] || 0) > 0 && c.pointsPerHour > 0)
                    .map((c) => (
                      <div
                        key={c.id}
                        title={`${c.name}: ${fmtDur(mins[c.id])}`}
                        style={{ width: `${(((c.pointsPerHour * (mins[c.id] || 0)) / 60) / totalPts) * 100}%`, backgroundColor: c.color }}
                      />
                    ))}
                </div>
                <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-700">{dayPoints(state, d).toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-2 font-semibold text-slate-900">Category drift — this week vs last week</h3>
        <div className="space-y-2">
          {drift
            .filter((d) => d.now > 0 || d.before > 0)
            .sort((a, b) => b.now - a.now)
            .map(({ cat, now, before }) => {
              const delta = now - before;
              return (
                <div key={cat.id} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: cat.color }} />
                  <span className="w-28 font-medium text-slate-800">{cat.name}</span>
                  <span className="text-slate-500">{fmtDur(now)}/day avg</span>
                  <span className={`ml-auto font-semibold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-400"}`}>
                    {delta > 0 ? "+" : ""}{fmtDur(delta)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Insights ----------------
export function InsightsTab({
  state,
  setState,
}: {
  state: AppState;
  setState: (s: AppState) => void;
}) {
  const [goalCat, setGoalCat] = useState("exercise");
  const [goalMin, setGoalMin] = useState(45);
  const dates7 = lastNDates(7);
  const today = dateStr(new Date());
  const todayMin = dayMinutes(state, today);

  const avg = (id: string, ds: string[]) =>
    ds.reduce((s, d) => s + (dayMinutes(state, d)[id] || 0), 0) / Math.max(1, ds.length);
  const avgPts = dates7.reduce((s, d) => s + dayPoints(state, d), 0) / 7;
  const best = Math.max(...dates7.map((d) => dayPoints(state, d)));
  const earned = BADGES.filter((b) => b.check(state, dates7));

  const suggestions: string[] = [];
  if (avg("social", dates7) > 30)
    suggestions.push(`Social media is averaging ${fmtDur(avg("social", dates7))}/day. Cutting 30 min/day to a 3-pointer earns about +1.5 pts/day.`);
  if (avg("exercise", dates7) < 30)
    suggestions.push(`Exercise is averaging ${fmtDur(avg("exercise", dates7))}/day. A 45-minute workout is 4.5 blocks and 2.3 pts at 3 pts/hr.`);
  if (avg("sleep", dates7) < 420)
    suggestions.push(`Sleep is averaging ${fmtDur(avg("sleep", dates7))}/night — under 7h. Sleep is a 3-pointer, so an extra hour is worth 3 pts.`);
  if (avg("focus", dates7) < 60)
    suggestions.push(`Deep focus is averaging ${fmtDur(avg("focus", dates7))}/day. Protect a 2-hour morning block — at 2 pts/hr that's 4 pts.`);
  if (suggestions.length === 0)
    suggestions.push("Your week looks balanced — every category is at or above target. Try raising a goal to keep beating yesterday.");

  const addGoal = () => {
    const cat = state.categories.find((c) => c.id === goalCat);
    if (!cat) return;
    setState({
      ...state,
      goals: [...state.goals, { id: `g${Date.now()}`, categoryId: goalCat, targetMinutes: goalMin, label: `${cat.name} ${goalMin} min/day` }],
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="text-2xl font-extrabold text-slate-900">{avgPts.toFixed(1)}</div>
          <div className="text-xs text-slate-500">avg pts / day (7d)</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="text-2xl font-extrabold text-slate-900">{best.toFixed(1)}</div>
          <div className="text-xs text-slate-500">best day (7d)</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="text-2xl font-extrabold text-slate-900">{fmtDur(avg("sleep", dates7))}</div>
          <div className="text-xs text-slate-500">avg sleep / night</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-4">
        {[
          ["Exercise", fmtDur(avg("exercise", dates7))],
          ["Learning", fmtDur(avg("learning", dates7))],
          ["Deep Focus", fmtDur(avg("focus", dates7))],
          ["Social Media", fmtDur(avg("social", dates7))],
        ].map(([label, v]) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="text-lg font-bold text-slate-900">{v}</div>
            <div className="text-xs text-slate-500">{label} / day</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Badges</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {BADGES.map((b) => {
            const got = earned.some((e) => e.id === b.id);
            return (
              <div key={b.id} className={`rounded-xl p-3 text-center ring-1 ${got ? "bg-amber-50 ring-amber-200" : "bg-slate-50 ring-slate-200 opacity-60"}`}>
                <div className="text-2xl">{got ? "🏅" : "🔒"}</div>
                <div className="text-sm font-semibold text-slate-800">{b.name}</div>
                <div className="text-xs text-slate-500">{b.desc}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">Earned {earned.length} of {BADGES.length} this week.</p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-2 font-semibold text-slate-900">Suggestions</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-semibold text-slate-900">Goals</h3>
        {state.goals.length === 0 && <p className="mb-3 text-sm text-slate-500">No goals yet — set one below.</p>}
        <div className="space-y-3">
          {state.goals.map((g) => {
            const cat = state.categories.find((c) => c.id === g.categoryId);
            const done = todayMin[g.categoryId] || 0;
            const pct = Math.min(100, (done / g.targetMinutes) * 100);
            return (
              <div key={g.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-800">{g.label}</span>
                  <span className="text-slate-500">
                    {fmtDur(done)} / {fmtDur(g.targetMinutes)} today · {Math.round(pct)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <button
                  onClick={() => setState({ ...state, goals: state.goals.filter((x) => x.id !== g.id) })}
                  className="mt-1 text-xs text-slate-400 underline"
                >
                  Remove
                </button>
                <span className="hidden">{cat?.name}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={goalCat} onChange={(e) => setGoalCat(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {state.categories.filter((c) => c.pointsPerHour > 0).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input type="number" min={5} max={480} step={5} value={goalMin} onChange={(e) => setGoalMin(Number(e.target.value))} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <span className="text-sm text-slate-500">min / day</span>
          <button onClick={addGoal} className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white">Add goal</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Blocks today: {blocksOf(Object.values(todayMin).reduce((s, m) => s + m, 0)).toFixed(1)} of 144.
        </p>
      </div>
    </div>
  );
}
