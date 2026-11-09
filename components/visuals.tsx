"use client";

import { useState } from "react";
import {
  blocksOf,
  Category,
  fmtDur,
  fmtMin,
  fmtPts,
  scoreMinutes,
} from "../lib/core";

// ---------- 144-block waffle ----------
export function Waffle({
  minutes,
  categories,
  isolated,
  onIsolate,
}: {
  minutes: Record<string, number>;
  categories: Category[];
  isolated: string | null;
  onIsolate: (id: string | null) => void;
}) {
  const [mode, setMode] = useState<"minutes" | "points">("minutes");
  const map = Object.fromEntries(categories.map((c) => [c.id, c]));

  // Build the 144 cells (10-min blocks). Fractional blocks: a 45-min
  // category contributes 4.5 blocks — render whole blocks, then one
  // half-width block for the .5 remainder.
  type Cell = { cat: string; frac: boolean };
  const buildCells = (): Cell[] => {
    const cells: Cell[] = [];
    const entries = Object.entries(minutes)
      .filter(([, m]) => m > 0)
      .sort((a, b) => {
        if (mode === "points") {
          const pa = (map[a[0]]?.pointsPerBlock ?? 0) * a[1];
          const pb = (map[b[0]]?.pointsPerBlock ?? 0) * b[1];
          return pb - pa;
        }
        return b[1] - a[1];
      });
    for (const [id, m] of entries) {
      const b = blocksOf(m);
      const whole = Math.floor(b);
      for (let i = 0; i < whole && cells.length < 144; i++) cells.push({ cat: id, frac: false });
      if (b - whole >= 0.5 && cells.length < 144) cells.push({ cat: id, frac: true });
    }
    while (cells.length < 144) cells.push({ cat: "free", frac: false });
    return cells.slice(0, 144);
  };

  const cells = buildCells();
  const totalBlocks = Object.values(minutes).reduce((s, m) => s + blocksOf(m), 0);
  const pts = scoreMinutes(minutes, categories);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Your day in 144 blocks</h3>
          <p className="text-xs text-slate-500">
            {totalBlocks.toFixed(1)} of 144 blocks · 1 block = 10 min · {fmtPts(pts)} pts
          </p>
        </div>
        <div className="flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
          {(["minutes", "points"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 capitalize ${
                mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
        {cells.map((cell, i) => {
          const c = map[cell.cat];
          if (!c) return null;
          const dim = isolated && isolated !== cell.cat;
          const negative = c.pointsPerBlock < 0;
          return (
            <div
              key={i}
              title={`${c.name} · ${mode === "points" ? `${c.pointsPerBlock} pts/block` : "10 min"}`}
              className={`aspect-square rounded-[3px] ${dim ? "opacity-15" : ""} ${
                cell.frac ? "w-1/2" : "w-full"
              } ${negative ? "border-2 border-dashed" : ""}`}
              style={{ backgroundColor: c.color, borderColor: negative ? c.color : undefined }}
            />
          );
        })}
      </div>

      <div className="mt-3 space-y-1">
        {categories
          .filter((c) => (minutes[c.id] || 0) > 0)
          .sort((a, b) => (minutes[b.id] || 0) - (minutes[a.id] || 0))
          .map((c) => {
            const m = minutes[c.id] || 0;
            const p = (c.pointsPerBlock * m) / 10;
            const active = isolated === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onIsolate(active ? null : c.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${
                  active ? "bg-slate-100 ring-1 ring-slate-300" : "hover:bg-slate-50"
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="flex-1 font-medium text-slate-800">{c.name}</span>
                <span className="text-slate-500">
                  {fmtDur(m)} · {blocksOf(m).toFixed(1)} blk
                </span>
                <span className={`w-16 text-right font-semibold ${p < 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {fmtPts(p)} pts
                </span>
              </button>
            );
          })}
      </div>
      {isolated && (
        <p className="mt-2 text-xs text-slate-500">
          Showing <b>{map[isolated]?.name}</b> across all views — tap it again to clear.
        </p>
      )}
    </div>
  );
}

// ---------- 24h rhythm clock ----------
export function RhythmClock({
  minutes,
  categories,
  recurring,
  date,
  isolated,
}: {
  minutes: Record<string, number>;
  categories: Category[];
  recurring: { startMin: number; endMin: number; categoryId: string; weekday: number }[];
  date: string;
  isolated: string | null;
}) {
  const map = Object.fromEntries(categories.map((c) => [c.id, c]));
  const wd = new Date(date + "T12:00:00").getDay();
  const runs = recurring
    .filter((r) => r.weekday === wd)
    .sort((a, b) => a.startMin - b.startMin);
  const cx = 100;
  const cy = 100;
  const rOuter = 88;
  const rInner = 62;
  const arc = (startMin: number, endMin: number) => {
    const a0 = ((startMin / 1440) * 360 - 90) * (Math.PI / 180);
    const a1 = ((endMin / 1440) * 360 - 90) * (Math.PI / 180);
    const large = endMin - startMin > 720 ? 1 : 0;
    const x0 = cx + rOuter * Math.cos(a0);
    const y0 = cy + rOuter * Math.sin(a0);
    const x1 = cx + rOuter * Math.cos(a1);
    const y1 = cy + rOuter * Math.sin(a1);
    const x2 = cx + rInner * Math.cos(a1);
    const y2 = cy + rInner * Math.sin(a1);
    const x3 = cx + rInner * Math.cos(a0);
    const y3 = cy + rInner * Math.sin(a0);
    return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="font-semibold text-slate-900">24-hour rhythm clock</h3>
      <p className="mb-2 text-xs text-slate-500">Your recurring schedule, around the clock.</p>
      <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[280px]">
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#e2e8f0" strokeWidth={26} />
        {runs.map((run, i) => {
          const c = map[run.categoryId];
          if (!c) return null;
          const dim = isolated && isolated !== run.categoryId;
          return (
            <path
              key={i}
              d={arc(run.startMin, run.endMin)}
              fill={c.color}
              opacity={dim ? 0.15 : 0.9}
            />
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const a = ((h / 24) * 360 - 90) * (Math.PI / 180);
          return (
            <text
              key={h}
              x={cx + 52 * Math.cos(a)}
              y={cy + 52 * Math.sin(a) + 4}
              textAnchor="middle"
              fontSize={11}
              fill="#475569"
              fontWeight={600}
            >
              {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 space-y-1">
        {runs.map((run, i) => {
          const c = map[run.categoryId];
          if (!c) return null;
          const dim = isolated && isolated !== run.categoryId;
          return (
            <div key={i} className={`flex items-center gap-2 text-sm ${dim ? "opacity-40" : ""}`}>
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="flex-1 text-slate-700">
                {fmtMin(run.startMin)}–{fmtMin(run.endMin)}
              </span>
              <span className="font-medium text-slate-800">{c.name}</span>
              <span className="text-slate-500">{fmtDur(run.endMin - run.startMin)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Actual minutes today: {Object.keys(minutes).length} categories tracked.
      </p>
    </div>
  );
}

// ---------- Time Portfolio treemap ----------
export function Treemap({
  minutes,
  categories,
  targetMinutes,
  isolated,
}: {
  minutes: Record<string, number>;
  categories: Category[];
  targetMinutes: Record<string, number>;
  isolated: string | null;
}) {
  const map = Object.fromEntries(categories.map((c) => [c.id, c]));
  const pts = (id: string) => ((map[id]?.pointsPerBlock ?? 0) * (minutes[id] || 0)) / 10;
  const totalPts = categories.reduce((s, c) => s + Math.max(0, pts(c.id)), 0);
  const rows = categories
    .filter((c) => (minutes[c.id] || 0) > 0)
    .sort((a, b) => pts(b.id) - pts(a.id));

  // Lowest-return callout: most minutes at the lowest positive points/hr
  const positive = rows.filter((c) => c.pointsPerBlock > 0);
  const lowest = positive.length
    ? positive.reduce((a, b) => (a.pointsPerBlock <= b.pointsPerBlock ? a : b))
    : null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="font-semibold text-slate-900">Your time portfolio</h3>
      <p className="mb-3 text-xs text-slate-500">Sized by points earned — like an investment portfolio.</p>
      <div className="flex h-28 w-full overflow-hidden rounded-xl">
        {rows.map((c) => {
          const share = totalPts > 0 ? (Math.max(0, pts(c.id)) / totalPts) * 100 : 0;
          const dim = isolated && isolated !== c.id;
          return (
            <div
              key={c.id}
              className={`flex items-center justify-center overflow-hidden text-center text-[10px] font-bold text-white ${dim ? "opacity-20" : ""}`}
              style={{ width: `${Math.max(share, 0)}%`, backgroundColor: c.color, minWidth: share > 0 ? 8 : 0 }}
              title={`${c.name}: ${fmtPts(pts(c.id))} pts`}
            >
              {share >= 12 ? c.name : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((c) => {
          const actual = minutes[c.id] || 0;
          const target = targetMinutes[c.id] || 0;
          const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 100;
          const dim = isolated && isolated !== c.id;
          return (
            <div key={c.id} className={dim ? "opacity-40" : ""}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-slate-500">
                  {fmtDur(actual)} / {fmtDur(target)} target · {fmtPts(pts(c.id))} pts
                </span>
              </div>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
              </div>
            </div>
          );
        })}
      </div>
      {lowest && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          💡 Lowest return: <b>{lowest.name}</b> earns {lowest.pointsPerBlock} pts per 10-min block.
          Shifting 30 min from {lowest.name} to a 3-pointer would earn +{(3 - lowest.pointsPerBlock) * 3} pts/day.
        </p>
      )}
    </div>
  );
}

// ---------- multi-line trend chart ----------
export function LineChart({
  series,
  height = 140,
}: {
  series: { name: string; color: string; values: number[] }[];
  height?: number;
}) {
  const w = 320;
  const h = height;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const min = 0;
  const x = (i: number, n: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * (w - 16) + 8);
  const y = (v: number) => h - 12 - ((v - min) / (max - min)) * (h - 28);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={8} x2={w - 8} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i, s.values.length)},${y(v)}`).join(" ");
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {series.map((s) =>
          s.values.map((v, i) => (
            <circle key={`${s.name}-${i}`} cx={x(i, s.values.length)} cy={y(v)} r={2.5} fill={s.color} />
          ))
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
