"use client";

import { useEffect, useRef, useState } from "react";
import { AppState, defaultState } from "../lib/core";
import Landing from "../components/Landing";
import Onboarding from "../components/Onboarding";
import TodayTab from "../components/TodayTab";
import { InsightsTab, TrendsTab } from "../components/TrendsInsights";
import { SetupTab, SpacesTab } from "../components/SpacesSetup";
import {
  getSession,
  isSupabaseConfigured,
  loadStateFromSupabase,
  saveStateToSupabase,
} from "../lib/supabase";

const KEY = "beatyesterday-v1";
const TABS = [
  { id: "today", label: "Today", icon: "📅" },
  { id: "trends", label: "Trends", icon: "📊" },
  { id: "insights", label: "Insights", icon: "💡" },
  { id: "spaces", label: "Spaces", icon: "👥" },
  { id: "setup", label: "Setup", icon: "⚙️" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.categories)) return parsed;
    }
  } catch {
    // corrupted storage -> fresh start
  }
  return defaultState();
}

export default function Home() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<TabId>("today");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [supaUserId, setSupaUserId] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string>("");
  const supaReady = useRef(false);

  // Initial load: localStorage first, then Supabase wins if it has data.
  useEffect(() => {
    const local = load();
    setState(local);
    if (!isSupabaseConfigured()) return;
    getSession()
      .then(async (session) => {
        if (!session?.user) return;
        setSupaUserId(session.user.id);
        try {
          const cloud = await loadStateFromSupabase(session.user.id);
          if (cloud) {
            setState(cloud);
          } else {
            // Fresh account — migrate the local state up once.
            await saveStateToSupabase(local, session.user.id);
          }
        } catch (e) {
          setSyncNote(e instanceof Error ? e.message : String(e));
        } finally {
          supaReady.current = true;
        }
      })
      .catch(() => {
        supaReady.current = true;
      });
  }, []);

  // Persist locally on every change.
  useEffect(() => {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  // Sync to Supabase when signed in (debounced 1s; never blocks the UI).
  useEffect(() => {
    if (!state || !supaUserId || !supaReady.current) return;
    const t = setTimeout(() => {
      saveStateToSupabase(state, supaUserId)
        .then(() => setSyncNote("Synced ✓"))
        .catch((e: unknown) => setSyncNote(e instanceof Error ? e.message : String(e)));
    }, 1000);
    return () => clearTimeout(t);
  }, [state, supaUserId]);

  if (state === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading Beat Yesterday…</p>
      </main>
    );
  }

  if (!state.onboarded) {
    return (
      <main className="min-h-screen bg-slate-50">
        {!showOnboarding ? (
          <Landing onStart={() => setShowOnboarding(true)} />
        ) : (
          <Onboarding onDone={setState} />
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              Beat Yesterday <span className="text-indigo-600">⏱️</span>
            </h1>
            <p className="text-xs text-slate-500">Beat yesterday. · Hi, {state.name}</p>
          </div>
          <span
            className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
            title={syncNote || undefined}
          >
            {supaUserId ? (syncNote === "Synced ✓" ? "☁️ Synced" : "☁️ Cloud") : "v1 · local data"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        {tab === "today" && <TodayTab state={state} setState={setState} />}
        {tab === "trends" && <TrendsTab state={state} />}
        {tab === "insights" && <InsightsTab state={state} setState={setState} />}
        {tab === "spaces" && <SpacesTab state={state} setState={setState} />}
        {tab === "setup" && <SetupTab state={state} setState={setState} />}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center py-2 text-[11px] font-medium ${
                tab === t.id ? "text-indigo-600" : "text-slate-500"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
