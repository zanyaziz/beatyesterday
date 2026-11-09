// Beat Yesterday — Google Calendar connect + import, and .ics file import.
// Shared by Onboarding (step 3) and Setup (Calendar section).
// When Supabase is not configured, shows the simulated toggle instead and
// explains what is needed. The parent supplies onApply, which takes the
// imported events and returns the import summary to display.

"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchGoogleEvents,
  importEventsIntoState,
  parseICS,
  type CalendarEvent,
  type ImportResult,
} from "../lib/calendar";
import {
  getProviderToken,
  getSession,
  isSupabaseConfigured,
  signInWithGoogle,
  signOut,
} from "../lib/supabase";

export type ImportSummary = Pick<ImportResult, "importedCount" | "daysAffected" | "unmatchedTitles">;

export default function CalendarImport({
  onApply,
  simulated,
  onSimulatedChange,
}: {
  /** Apply events to the app state; return the summary to show. */
  onApply: (events: CalendarEvent[]) => ImportSummary;
  /** Fallback when Supabase is not configured. */
  simulated: boolean;
  onSimulatedChange: (v: boolean) => void;
}) {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!configured) return;
    getSession()
      .then((s) => setEmail(s?.user?.email ?? null))
      .catch(() => setEmail(null));
  }, [configured]);

  const apply = (events: CalendarEvent[], source: string) => {
    try {
      const s = onApply(events);
      setSummary(s);
      setError(null);
      return s;
    } catch (e) {
      setError(`Import from ${source} failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  const importGoogle = async () => {
    setBusy("Importing from Google…");
    setError(null);
    try {
      const token = await getProviderToken();
      if (!token) {
        throw new Error(
          "No Google access token on this session — sign out and sign in with Google again (consent is required for calendar access)."
        );
      }
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const events = await fetchGoogleEvents(token, weekAgo.toISOString(), now.toISOString());
      if (events.length === 0) {
        setError("Google returned no timed events in the last 7 days (all-day events are skipped).");
      } else {
        apply(events, "Google Calendar");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setBusy(`Reading ${file.name}…`);
    setError(null);
    try {
      const text = await file.text();
      const events = parseICS(text);
      if (events.length === 0) {
        setError("No timed events found in that .ics file (all-day events are skipped).");
      } else {
        apply(events, file.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!configured) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <b>SIMULATED / prototype:</b> real Google Calendar sync needs Supabase — see{" "}
          <code>SUPABASE_SETUP.md</code>. Turning this on marks calendar events as
          “synced” from your recurring schedule in the demo — no real Google account
          is connected.
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
          <input
            type="checkbox"
            checked={simulated}
            onChange={(e) => onSimulatedChange(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block font-medium text-slate-800">Connect Google Calendar (simulated)</span>
            <span className="text-sm text-slate-500">
              Calendar events would map to categories by title keywords, and fill your day
              automatically. In v1 this is a placeholder toggle.
            </span>
          </span>
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">
            Or import a calendar file from your phone (.ics)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
            className="w-full text-sm text-slate-600"
          />
          <p className="mt-1 text-xs text-slate-500">
            Export an .ics from Apple Calendar or Google Calendar and upload it here — no
            account needed.
          </p>
        </div>
        {busy && <p className="text-sm text-slate-500">{busy}</p>}
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        {summary && <ImportSummaryView summary={summary} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {email ? (
        <div className="space-y-2">
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ Signed in with Google as <b>{email}</b>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void importGoogle()}
              disabled={!!busy}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Import last 7 days from Google Calendar
            </button>
            <button
              onClick={() => {
                void signOut().then(() => setEmail(null));
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300"
            >
              Sign out
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Events are matched to categories by title keywords (gym → Exercise, focus →
            Deep Focus, …) and bucketed into 10-minute blocks. Imported days are marked
            “adjusted”.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => {
              setError(null);
              void signInWithGoogle().catch((e: unknown) =>
                setError(e instanceof Error ? e.message : String(e))
              );
            }}
            className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white"
          >
            Connect Google Calendar
          </button>
          <p className="text-xs text-slate-500">
            Signs you in with Google (read-only calendar access). Your events are only
            used to score your days — nothing is shared with other members.
          </p>
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">
          Or import a calendar file from your phone (.ics)
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
          }}
          className="w-full text-sm text-slate-600"
        />
      </div>
      {busy && <p className="text-sm text-slate-500">{busy}</p>}
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      {summary && <ImportSummaryView summary={summary} />}
    </div>
  );
}

function ImportSummaryView({ summary }: { summary: ImportSummary }) {
  return (
    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      ✓ Imported <b>{summary.importedCount}</b> event{summary.importedCount === 1 ? "" : "s"}{" "}
      across <b>{summary.daysAffected}</b> day{summary.daysAffected === 1 ? "" : "s"}.
      {summary.unmatchedTitles.length > 0 && (
        <span className="block text-xs text-emerald-700">
          {summary.unmatchedTitles.length} event
          {summary.unmatchedTitles.length === 1 ? "" : "s"} didn&apos;t match a category and
          went to Free Time: {summary.unmatchedTitles.slice(0, 3).join(", ")}
          {summary.unmatchedTitles.length > 3 ? "…" : ""}
        </span>
      )}
    </div>
  );
}

// Re-exported for callers that need the raw import (e.g. onboarding preview).
export { importEventsIntoState };
