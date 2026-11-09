"use client";

import { useEffect, useState } from "react";
import { AppState, defaultState } from "../lib/core";
import Onboarding from "../components/Onboarding";
import TodayTab from "../components/TodayTab";
import { InsightsTab, TrendsTab } from "../components/TrendsInsights";
import { SetupTab, SpacesTab } from "../components/SpacesSetup";

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

  useEffect(() => {
    setState(load());
  }, []);

  useEffect(() => {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

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
        <Onboarding onDone={setState} />
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
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            v1 · local data
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
