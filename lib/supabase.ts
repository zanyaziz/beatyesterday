// Beat Yesterday — Supabase client + sync layer.
// Works with localStorage alone when the env vars are absent; Supabase
// activates only when NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are both set. Nothing here throws when
// Supabase is unconfigured — callers must check isSupabaseConfigured().

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import {
  AppState,
  Category,
  defaultState,
  scoreMinutes,
} from "./core";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
  }
  return client;
}

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export async function signInWithGoogle(): Promise<void> {
  const supa = createBrowserClient();
  if (!supa) throw new Error("Supabase is not configured — add the env vars first (see SUPABASE_SETUP.md).");
  const { error } = await supa.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: `openid email profile ${CALENDAR_SCOPE}`,
      queryParams: { access_type: "offline", prompt: "consent" },
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supa = createBrowserClient();
  if (!supa) return;
  const { error } = await supa.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession(): Promise<Session | null> {
  const supa = createBrowserClient();
  if (!supa) return null;
  const { data, error } = await supa.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

/** Google access token from the Supabase session (provider_token). Null when
 *  the user signed in without Google, or the token has expired. */
export async function getProviderToken(): Promise<string | null> {
  const session = await getSession();
  return session?.provider_token ?? null;
}

function fail(op: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  throw new Error(`Supabase ${op} failed: ${msg}`);
}

function tierOf(pointsPerBlock: number): string {
  if (pointsPerBlock === 3) return "3";
  if (pointsPerBlock === 2) return "2";
  if (pointsPerBlock === 1) return "1";
  if (pointsPerBlock === 0) return "0";
  return "negative";
}

/** Expand a day's minutes into 144 block categories (one per 10-min block),
 *  sampling the minute-array at each block start. */
function minutesToBlocks(minutes: Record<string, number>, cats: Category[]): (string | null)[] {
  const perMin: (string | null)[] = new Array(1440).fill(null);
  let cursor = 0;
  for (const c of cats) {
    const m = Math.max(0, Math.round(minutes[c.id] || 0));
    for (let i = 0; i < m && cursor < 1440; i++) perMin[cursor++] = c.id;
  }
  const blocks: (string | null)[] = [];
  for (let b = 0; b < 144; b++) blocks.push(perMin[b * 10]);
  return blocks;
}

export async function saveStateToSupabase(state: AppState, userId: string): Promise<void> {
  const supa = createBrowserClient();
  if (!supa) throw new Error("Supabase is not configured.");

  try {
    // Profile (created by the signup trigger too — upsert keeps it in sync).
    const { error: profErr } = await supa
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: state.name || "You",
          onboarding_completed: state.onboarded,
        },
        { onConflict: "id" }
      );
    if (profErr) throw profErr;

    // Categories: upsert by (user_id, name), then map display name -> uuid.
    const catRows = state.categories.map((c) => ({
      user_id: userId,
      name: c.name,
      color: c.color,
      points_per_block: c.pointsPerBlock,
      tier: tierOf(c.pointsPerBlock),
    }));
    const { data: savedCats, error: catErr } = await supa
      .from("categories")
      .upsert(catRows, { onConflict: "user_id,name" })
      .select("id,name");
    if (catErr) throw catErr;
    const catIdByName = new Map<string, string>(
      (savedCats ?? []).map((r: { id: string; name: string }) => [r.name, r.id])
    );
    const catId = (slug: string): string | undefined => {
      const cat = state.categories.find((c) => c.id === slug);
      return cat ? catIdByName.get(cat.name) : undefined;
    };

    const { error: budErr } = await supa.from("point_budgets").upsert(
      { user_id: userId, three_pointers: state.budget.three, two_pointers: state.budget.two },
      { onConflict: "user_id" }
    );
    if (budErr) throw budErr;

    // Recurring schedule: replace-all for the user.
    const { error: delRecErr } = await supa.from("recurring_blocks").delete().eq("user_id", userId);
    if (delRecErr) throw delRecErr;
    const recRows = state.recurring
      .map((b) => {
        const cid = catId(b.categoryId);
        if (!cid) return null;
        return {
          user_id: userId,
          weekday: b.weekday,
          start_block: Math.round(b.startMin / 10),
          end_block: Math.round(b.endMin / 10),
          category_id: cid,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (recRows.length > 0) {
      const { error: recErr } = await supa.from("recurring_blocks").insert(recRows);
      if (recErr) throw recErr;
    }

    // Day blocks + summaries: replace per date in state.days.
    for (const [date, rec] of Object.entries(state.days)) {
      const { error: delErr } = await supa
        .from("day_blocks")
        .delete()
        .eq("user_id", userId)
        .eq("date", date);
      if (delErr) throw delErr;
      const blocks = minutesToBlocks(rec.minutes, state.categories);
      const rows = blocks.map((catSlug, i) => ({
        user_id: userId,
        date,
        block_index: i,
        category_id: catSlug ? catId(catSlug) ?? null : null,
        source: "recurring" as const,
        status: rec.status,
      }));
      const { error: insErr } = await supa.from("day_blocks").insert(rows);
      if (insErr) throw insErr;
      const { error: sumErr } = await supa.from("day_summaries").upsert(
        {
          user_id: userId,
          date,
          total_points: scoreMinutes(rec.minutes, state.categories),
          confirmed_at: rec.status === "confirmed" ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,date" }
      );
      if (sumErr) throw sumErr;
    }

    // Goals: replace-all for the user.
    const { error: delGoalErr } = await supa.from("goals").delete().eq("user_id", userId);
    if (delGoalErr) throw delGoalErr;
    const goalRows = state.goals
      .map((g) => {
        const cid = catId(g.categoryId);
        if (!cid) return null;
        return { user_id: userId, category_id: cid, target_minutes_per_day: g.targetMinutes };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
    if (goalRows.length > 0) {
      const { error: goalErr } = await supa.from("goals").insert(goalRows);
      if (goalErr) throw goalErr;
    }
  } catch (e) {
    fail("save", e);
  }
}

/** Rebuild an AppState from Supabase. Returns null when the user has
 *  nothing saved yet (fresh account) so the caller can keep local data
 *  and migrate it up instead. */
export async function loadStateFromSupabase(userId: string): Promise<AppState | null> {
  const supa = createBrowserClient();
  if (!supa) throw new Error("Supabase is not configured.");

  try {
    const { data: prof, error: profErr } = await supa
      .from("profiles")
      .select("display_name,onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) throw profErr;

    const { data: cats, error: catErr } = await supa
      .from("categories")
      .select("id,name,color,points_per_block")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (catErr) throw catErr;
    if (!cats || cats.length === 0) return null;

    const state = defaultState();
    state.name = prof?.display_name ?? "You";
    state.onboarded = prof?.onboarding_completed ?? false;
    state.categories = cats.map((c: { id: string; name: string; color: string; points_per_block: number }) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      pointsPerBlock: Number(c.points_per_block),
    }));
    // Categories are stored by display name; restore the well-known slugs
    // so the rest of the app (schedule builder, keyword map) keeps working.
    const slugByName: Record<string, string> = {
      Sleep: "sleep",
      Family: "family",
      Learning: "learning",
      Exercise: "exercise",
      "Deep Focus": "focus",
      Work: "work",
      Chores: "chores",
      Commute: "commute",
      "Free Time": "free",
      "Social Media": "social",
    };
    const uuidToSlug = new Map<string, string>();
    for (const c of state.categories) {
      const slug = slugByName[c.name];
      if (slug) {
        uuidToSlug.set(c.id, slug);
        c.id = slug;
      }
    }

    const { data: budget, error: budErr } = await supa
      .from("point_budgets")
      .select("three_pointers,two_pointers")
      .eq("user_id", userId)
      .maybeSingle();
    if (budErr) throw budErr;
    if (budget) state.budget = { three: budget.three_pointers, two: budget.two_pointers };

    const { data: rec, error: recErr } = await supa
      .from("recurring_blocks")
      .select("weekday,start_block,end_block,category_id")
      .eq("user_id", userId);
    if (recErr) throw recErr;
    if (rec && rec.length > 0) {
      state.recurring = rec.map(
        (r: { weekday: number; start_block: number; end_block: number; category_id: string }, i: number) => ({
          id: `r${r.weekday}-${r.start_block * 10}-${i}`,
          weekday: r.weekday,
          startMin: r.start_block * 10,
          endMin: r.end_block * 10,
          categoryId: uuidToSlug.get(r.category_id) ?? r.category_id,
        })
      );
    }

    const { data: blocks, error: blkErr } = await supa
      .from("day_blocks")
      .select("date,block_index,category_id,status")
      .eq("user_id", userId)
      .order("date", { ascending: true });
    if (blkErr) throw blkErr;
    if (blocks && blocks.length > 0) {
      const byDate = new Map<string, { minutes: Record<string, number>; status: string }>();
      for (const b of blocks as { date: string; category_id: string | null; status: string }[]) {
        const entry = byDate.get(b.date) ?? { minutes: {}, status: b.status };
        if (b.category_id) {
          const slug = uuidToSlug.get(b.category_id) ?? b.category_id;
          entry.minutes[slug] = (entry.minutes[slug] || 0) + 10;
        }
        byDate.set(b.date, entry);
      }
      for (const [date, entry] of byDate) {
        state.days[date] = {
          date,
          status: (entry.status as AppState["days"][string]["status"]) ?? "assumed",
          minutes: entry.minutes,
        };
      }
    }

    const { data: goals, error: goalErr } = await supa
      .from("goals")
      .select("category_id,target_minutes_per_day")
      .eq("user_id", userId)
      .eq("active", true);
    if (goalErr) throw goalErr;
    if (goals) {
      state.goals = goals.map((g: { category_id: string; target_minutes_per_day: number }, i: number) => {
        const cat = state.categories.find((c) => c.id === (uuidToSlug.get(g.category_id) ?? g.category_id));
        return {
          id: `g${i}`,
          categoryId: uuidToSlug.get(g.category_id) ?? g.category_id,
          targetMinutes: g.target_minutes_per_day,
          label: `${cat?.name ?? "Goal"} ${g.target_minutes_per_day} min/day`,
        };
      });
    }

    return state;
  } catch (e) {
    fail("load", e);
  }
}
