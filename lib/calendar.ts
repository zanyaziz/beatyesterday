// Beat Yesterday — calendar import (Google Calendar API + .ics files).
// Events are mapped to categories by title keywords, then bucketed into
// 10-minute blocks on the right day. No network calls here except the
// Google Calendar fetch; the .ics parser is pure text parsing.

import { AppState, dateStr, dayMinutes } from "./core";

export type CalendarEvent = {
  id?: string;
  title: string;
  /** ISO-8601 start/end. Floating times are treated as local time. */
  start: string;
  end: string;
};

export type ImportResult = {
  state: AppState;
  importedCount: number;
  daysAffected: number;
  unmatchedTitles: string[];
};

// ---- keyword map: event title -> category id (first match wins) ----
const KEYWORDS: { re: RegExp; cat: string }[] = [
  { re: /gym|workout|run\b|running|yoga|pilates|swim|tennis|lift|exercise|training|spin|hike|crossfit/i, cat: "exercise" },
  { re: /sleep|nap|bedtime/i, cat: "sleep" },
  { re: /focus|deep work|heads.?down|writing|study hall/i, cat: "focus" },
  { re: /family|kids|aydin|daughter|son|umema|wife|mom|dad|dinner with|playdate/i, cat: "family" },
  { re: /learn|class|course|study|lesson|lecture|read|book club|tutorial/i, cat: "learning" },
  { re: /commute|flight|travel|drive to|train to|airport/i, cat: "commute" },
  { re: /social|instagram|tiktok|scroll|doomscroll/i, cat: "social" },
  { re: /meeting|standup|stand-up|work|office|call|interview|review|sync|1:1|one.on.one|deadline|shift/i, cat: "work" },
  { re: /clean|chore|laundry|grocer|errand|cook|meal prep/i, cat: "chores" },
];

export function categorizeEvent(title: string): { cat: string; matched: boolean } {
  for (const k of KEYWORDS) {
    if (k.re.test(title)) return { cat: k.cat, matched: true };
  }
  return { cat: "free", matched: false };
}

// ---- Google Calendar API ----
type GCalEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function fetchGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
    `?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Calendar returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  const events: CalendarEvent[] = [];
  for (const e of (data.items ?? []) as GCalEvent[]) {
    // Skip all-day events (date only, no time) — they carry no minutes.
    if (!e.start?.dateTime || !e.end?.dateTime) continue;
    events.push({ id: e.id, title: e.summary ?? "(no title)", start: e.start.dateTime, end: e.end.dateTime });
  }
  return events;
}

// ---- import into AppState ----
export function importEventsIntoState(state: AppState, events: CalendarEvent[]): ImportResult {
  // Deep copy so the caller's state is untouched on failure.
  const next: AppState = JSON.parse(JSON.stringify(state));
  const daysAffected = new Set<string>();
  const unmatchedTitles: string[] = [];
  let importedCount = 0;

  for (const ev of events) {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    const { cat, matched } = categorizeEvent(ev.title);
    if (!matched) unmatchedTitles.push(ev.title);

    // Split multi-day events at midnight so minutes land on the right day.
    let cursor = new Date(start);
    while (cursor < end) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(24, 0, 0, 0);
      const segEnd = end < dayEnd ? end : dayEnd;
      const minutes = Math.round((segEnd.getTime() - cursor.getTime()) / 60000);
      if (minutes >= 5) {
        const date = dateStr(cursor);
        const mins = { ...dayMinutes(next, date) };
        // Take the minutes from Free Time first, then the largest other
        // bucket that isn't the target category.
        let remaining = minutes;
        const takeFrom = (id: string) => {
          const avail = mins[id] || 0;
          const take = Math.min(avail, remaining);
          mins[id] = avail - take;
          remaining -= take;
        };
        takeFrom("free");
        if (remaining > 0) {
          const others = Object.entries(mins)
            .filter(([id, m]) => id !== cat && m > 0)
            .sort((a, b) => b[1] - a[1]);
          for (const [id] of others) {
            if (remaining <= 0) break;
            takeFrom(id);
          }
        }
        mins[cat] = (mins[cat] || 0) + (minutes - remaining);
        const prev = next.days[date];
        next.days[date] = {
          date,
          status: prev?.status === "confirmed" ? "confirmed" : "adjusted",
          minutes: mins,
        };
        daysAffected.add(date);
        importedCount++;
      }
      cursor = segEnd;
    }
  }

  return { state: next, importedCount, daysAffected: daysAffected.size, unmatchedTitles: [...new Set(unmatchedTitles)] };
}

// ---- .ics parser (phone calendars) ----
function unfoldIcs(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseIcsDate(value: string): Date | null {
  // YYYYMMDDTHHMMSSZ (UTC), YYYYMMDDTHHMMSS (floating = local), YYYYMMDD.
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(s ?? 0)));
  return new Date(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(s ?? 0));
}

function unescapeIcs(value: string): string {
  return value.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").replace(/\\\\/g, "\\");
}

export function parseICS(text: string): CalendarEvent[] {
  const lines = unfoldIcs(text);
  const events: CalendarEvent[] = [];
  let cur: Record<string, string> | null = null;
  const flush = () => {
    if (!cur) return;
    const start = cur.DTSTART ? parseIcsDate(cur.DTSTART) : null;
    const end = cur.DTEND ? parseIcsDate(cur.DTEND) : null;
    // All-day (date-only) events have no usable minutes — skip them.
    if (start && end && end > start && cur.DTSTART.includes("T")) {
      events.push({
        id: cur.UID,
        title: cur.SUMMARY ? unescapeIcs(cur.SUMMARY) : "(no title)",
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
    cur = null;
  };
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
    } else if (line === "END:VEVENT") {
      flush();
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const key = line.slice(0, idx).split(";")[0].toUpperCase();
        if (["DTSTART", "DTEND", "SUMMARY", "UID"].includes(key)) {
          cur[key] = line.slice(idx + 1);
        }
      }
    }
  }
  return events;
}
