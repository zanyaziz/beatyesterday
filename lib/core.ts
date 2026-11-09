// Beat Yesterday — core data model + points engine.
// Day = 144 blocks of 10 minutes. points = pointsPerHour * minutes / 60.
// v1 persistence is localStorage; see supabase/schema.sql for the
// production data model this maps to 1:1.

export type Category = {
  id: string;
  name: string;
  color: string;
  pointsPerHour: number;
};

export type RecBlock = {
  id: string;
  weekday: number; // 0 = Sunday
  startMin: number; // 0..1440
  endMin: number;
  categoryId: string;
};

export type DayStatus = "assumed" | "confirmed" | "adjusted";

export type DayRecord = {
  date: string; // YYYY-MM-DD
  status: DayStatus;
  minutes: Record<string, number>;
};

export type Goal = {
  id: string;
  categoryId: string;
  targetMinutes: number; // per day
  label: string;
};

export type Sharing = "detailed" | "totals" | "private";

export interface ScheduleAnswers {
  bedtime: string; // "23:00"
  wake: string; // "07:00"
  leave: string; // "08:00"
  commuteMin: number;
  workStart: string;
  workEnd: string;
  workoutDays: number[]; // weekdays 0-6
  workoutTime: string;
  workoutMin: number;
}

export interface AppState {
  onboarded: boolean;
  name: string;
  budget: { three: number; two: number };
  categories: Category[];
  recurring: RecBlock[];
  calendarSimulated: boolean;
  sharing: Sharing;
  days: Record<string, DayRecord>;
  goals: Goal[];
  createdAt: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "sleep", name: "Sleep", color: "#6366f1", pointsPerHour: 3 },
  { id: "family", name: "Family", color: "#f59e0b", pointsPerHour: 3 },
  { id: "learning", name: "Learning", color: "#10b981", pointsPerHour: 3 },
  { id: "exercise", name: "Exercise", color: "#ef4444", pointsPerHour: 3 },
  { id: "focus", name: "Deep Focus", color: "#8b5cf6", pointsPerHour: 2 },
  { id: "work", name: "Work", color: "#3b82f6", pointsPerHour: 1 },
  { id: "chores", name: "Chores", color: "#84cc16", pointsPerHour: 1 },
  { id: "commute", name: "Commute", color: "#06b6d4", pointsPerHour: 1 },
  { id: "free", name: "Free Time", color: "#9ca3af", pointsPerHour: 1 },
  { id: "social", name: "Social Media", color: "#ec4899", pointsPerHour: -0.5 },
];

export const DEFAULT_ANSWERS: ScheduleAnswers = {
  bedtime: "23:00",
  wake: "07:00",
  leave: "08:00",
  commuteMin: 30,
  workStart: "09:00",
  workEnd: "17:00",
  workoutDays: [1, 3, 5],
  workoutTime: "07:00",
  workoutMin: 45,
};

export const CATEGORY_MAP = (cats: Category[]) =>
  Object.fromEntries(cats.map((c) => [c.id, c]));

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function fmtDur(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function blocksOf(min: number): number {
  return min / 10;
}

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00").getDay();
}

export function prettyDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---- schedule builder: minute-array, priority order, gaps = Free Time ----
function buildTemplate(
  a: ScheduleAnswers,
  weekend: boolean,
  workoutToday: boolean
): RecBlock[] {
  const assign: string[] = new Array(1440).fill("free");
  const paint = (cat: string, start: number, end: number) => {
    for (let m = Math.max(0, start); m < Math.min(1440, end); m++) assign[m] = cat;
  };
  const bed = toMin(a.bedtime);
  const wake = toMin(a.wake);
  // Sleep (lowest priority paint first so later paints win where they overlap)
  paint("sleep", bed, 1440);
  paint("sleep", 0, wake);
  // Social + learning + chores (evening wind-down)
  paint("social", toMin("21:00"), toMin("21:30"));
  paint("learning", toMin("20:00"), toMin("20:30"));
  if (weekend) {
    paint("family", toMin("10:00"), toMin("12:00"));
    paint("family", toMin("17:00"), toMin("19:00"));
    paint("chores", toMin("12:00"), toMin("12:30"));
    paint("learning", toMin("09:00"), toMin("09:30"));
  } else {
    paint("chores", toMin("19:30"), toMin("20:00"));
    paint("family", toMin(a.workEnd) + a.commuteMin, toMin(a.workEnd) + a.commuteMin + 120);
  }
  if (!weekend) {
    // Work day: commute, deep focus, work
    paint("commute", toMin(a.leave), toMin(a.leave) + a.commuteMin);
    paint("commute", toMin(a.workEnd), toMin(a.workEnd) + a.commuteMin);
    paint("focus", toMin(a.workStart), toMin(a.workStart) + 120);
    paint("work", toMin(a.workStart), toMin(a.workEnd));
  }
  if (workoutToday) {
    paint("exercise", toMin(a.workoutTime), toMin(a.workoutTime) + a.workoutMin);
  }
  // Re-paint sleep last so it wins any overlap (bedtime/wake are anchors)
  paint("sleep", bed, 1440);
  paint("sleep", 0, wake);
  // Compress to blocks
  const blocks: RecBlock[] = [];
  let cur = assign[0];
  let start = 0;
  for (let m = 1; m <= 1440; m++) {
    if (m === 1440 || assign[m] !== cur) {
      blocks.push({ id: "", weekday: -1, startMin: start, endMin: m, categoryId: cur });
      if (m < 1440) {
        cur = assign[m];
        start = m;
      }
    }
  }
  return blocks;
}

export function buildRecurring(a: ScheduleAnswers): RecBlock[] {
  const out: RecBlock[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const weekend = wd === 0 || wd === 6;
    const tpl = buildTemplate(a, weekend, a.workoutDays.includes(wd));
    for (const b of tpl) {
      out.push({ ...b, id: `r${wd}-${b.startMin}`, weekday: wd });
    }
  }
  return out;
}

export function minutesFromRecurring(recurring: RecBlock[], date: string): Record<string, number> {
  const wd = weekdayOf(date);
  const mins: Record<string, number> = {};
  for (const b of recurring) {
    if (b.weekday !== wd) continue;
    mins[b.categoryId] = (mins[b.categoryId] || 0) + (b.endMin - b.startMin);
  }
  return mins;
}

export function scoreMinutes(minutes: Record<string, number>, cats: Category[]): number {
  const map = CATEGORY_MAP(cats);
  let total = 0;
  for (const [id, m] of Object.entries(minutes)) {
    const c = map[id];
    if (c) total += (c.pointsPerHour * m) / 60;
  }
  return total;
}

export function dayMinutes(state: AppState, date: string): Record<string, number> {
  const rec = state.days[date];
  if (rec) return rec.minutes;
  return minutesFromRecurring(state.recurring, date);
}

export function dayStatus(state: AppState, date: string): DayStatus {
  return state.days[date]?.status ?? "assumed";
}

export function dayPoints(state: AppState, date: string): number {
  return scoreMinutes(dayMinutes(state, date), state.categories);
}

// Deterministic pseudo-variation so seeded history isn't perfectly flat.
function vary(seed: number, i: number): number {
  return 1 + 0.08 * Math.sin(seed * 12.9898 + i * 78.233);
}

export function seedHistory(state: AppState): Record<string, DayRecord> {
  const days: Record<string, DayRecord> = {};
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = dateStr(addDays(today, -i));
    const base = minutesFromRecurring(state.recurring, d);
    const mins: Record<string, number> = {};
    for (const [id, m] of Object.entries(base)) {
      // Vary social + exercise a little; keep the day totalling 1440 by
      // adjusting Free Time to absorb the difference.
      if (id === "social") mins[id] = Math.round(m * vary(3, i));
      else if (id === "exercise" && m > 0) mins[id] = Math.round(m * vary(7, i));
      else mins[id] = m;
    }
    const total = Object.values(mins).reduce((s, v) => s + v, 0);
    mins["free"] = Math.max(0, (mins["free"] || 0) + (1440 - total));
    days[d] = { date: d, status: "assumed", minutes: mins };
  }
  return days;
}

export function defaultState(): AppState {
  return {
    onboarded: false,
    name: "",
    budget: { three: 4, two: 1 },
    categories: DEFAULT_CATEGORIES,
    recurring: buildRecurring(DEFAULT_ANSWERS),
    calendarSimulated: false,
    sharing: "totals",
    days: {},
    goals: [],
    createdAt: new Date().toISOString(),
  };
}

// ---- badges ----
export type BadgeDef = {
  id: string;
  name: string;
  desc: string;
  check: (state: AppState, dates: string[]) => boolean;
};

export const BADGES: BadgeDef[] = [
  {
    id: "rested",
    name: "Well Rested",
    desc: "Averaged 7h+ sleep over the last 7 days",
    check: (s, ds) => {
      const avg = ds.reduce((t, d) => t + (dayMinutes(s, d)["sleep"] || 0), 0) / Math.max(1, ds.length);
      return avg >= 420;
    },
  },
  {
    id: "mover",
    name: "Daily Mover",
    desc: "30+ min exercise on 5 of the last 7 days",
    check: (s, ds) => ds.filter((d) => (dayMinutes(s, d)["exercise"] || 0) >= 30).length >= 5,
  },
  {
    id: "curious",
    name: "Curious Mind",
    desc: "20+ min learning every day this week",
    check: (s, ds) => ds.length > 0 && ds.every((d) => (dayMinutes(s, d)["learning"] || 0) >= 20),
  },
  {
    id: "deep",
    name: "Deep Worker",
    desc: "Averaged 90+ min deep focus over the last 7 days",
    check: (s, ds) => {
      const avg = ds.reduce((t, d) => t + (dayMinutes(s, d)["focus"] || 0), 0) / Math.max(1, ds.length);
      return avg >= 90;
    },
  },
  {
    id: "lowscroll",
    name: "Low Scroll",
    desc: "Averaged 30 min or less of social media over the last 7 days",
    check: (s, ds) => {
      const avg = ds.reduce((t, d) => t + (dayMinutes(s, d)["social"] || 0), 0) / Math.max(1, ds.length);
      return avg <= 30;
    },
  },
  {
    id: "rising",
    name: "Rising",
    desc: "Today beat yesterday — and your 7-day average",
    check: (s, ds) => {
      if (ds.length < 2) return false;
      const today = dayPoints(s, ds[ds.length - 1]);
      const yday = dayPoints(s, ds[ds.length - 2]);
      const avg = ds.reduce((t, d) => t + dayPoints(s, d), 0) / ds.length;
      return today > yday && today > avg;
    },
  },
];

export function lastNDates(n: number, end: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateStr(addDays(end, -i)));
  return out;
}

// ---- demo Space members (clearly labeled demo data) ----
export type DemoMember = {
  id: string;
  name: string;
  sharing: Sharing;
  color: string;
  base: number; // points offset vs user
  swing: number;
};

export const DEMO_MEMBERS: DemoMember[] = [
  { id: "maya", name: "Maya", sharing: "totals", color: "#f59e0b", base: 3.5, swing: 4 },
  { id: "dev", name: "Dev", sharing: "detailed", color: "#10b981", base: -2, swing: 5 },
  { id: "priya", name: "Priya", sharing: "private", color: "#8b5cf6", base: 1, swing: 3 },
  { id: "sam", name: "Sam", sharing: "detailed", color: "#06b6d4", base: -5, swing: 6 },
];

export function demoPoints(m: DemoMember, state: AppState, date: string): number {
  const i = new Date(date + "T12:00:00").getDate();
  return Math.max(0, dayPoints(state, date) + m.base + m.swing * Math.sin(i * 1.7 + m.id.length));
}

export function demoMinutes(m: DemoMember, state: AppState, date: string): Record<string, number> {
  const mins = dayMinutes(state, date);
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(mins)) {
    out[id] = Math.max(0, Math.round(v * (1 + m.base / 50)));
  }
  return out;
}
