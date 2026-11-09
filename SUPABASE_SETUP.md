# Beat Yesterday — Supabase + Google Calendar setup

Do these in order. Nothing here needs the command line — it is all dashboard
work. The app already contains the code (`lib/supabase.ts`, `lib/calendar.ts`,
`supabase/schema.sql`); these steps just connect it.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**.
2. Name it `beatyesterday`, pick a region close to you, set a database password
   (save it somewhere safe — you will not need it again for this setup).
3. Wait for the project to finish provisioning (a minute or two).

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` in this repo, copy the whole file, paste it in,
   and click **Run**.
3. It is re-runnable — if you run it twice, the second run is a no-op for the
   tables and recreates the policies. It creates the tables, row-level
   security policies (users can only read/write their own rows), and a trigger
   that creates a profile row whenever someone signs up.
4. Sanity check: **Table Editor** should now list `profiles`, `categories`,
   `day_blocks`, `goals`, `spaces`, etc.

## 3. Enable Google sign-in in Supabase Auth

1. In Supabase, open **Authentication → Sign-in / Providers → Google** and
   turn it on. It will ask for a **Client ID** and **Client Secret** — those
   come from Google Cloud, next step.
2. On the same Google provider page, copy the **Callback URL** (it looks like
   `https://<your-project-ref>.supabase.co/auth/v1/callback`). You will paste
   it into Google Cloud in step 4.

## 4. Create the Google OAuth client

1. Go to https://console.cloud.google.com → create a project (name it
   `Beat Yesterday`, or reuse an existing one).
2. **APIs & Services → Library**: search for **Google Calendar API** and
   click **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Fill in the app name (`Beat Yesterday`), your email, and the app domain
     later if you have one (leave blank for now).
   - **Scopes → Add**: add `https://www.googleapis.com/auth/calendar.readonly`
     (read-only calendar access — the app never writes to your calendar).
   - Save. (While the app is in "Testing" mode, only Google accounts you add
     as test users can sign in — add your own account under **Test users**.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `Beat Yesterday (Supabase)`.
   - **Authorized redirect URIs → Add URI**: paste the Supabase callback URL
     from step 3.2.
   - Create. Copy the **Client ID** and **Client Secret**.
5. Back in Supabase (**Authentication → Sign-in / Providers → Google**),
   paste the Client ID and Client Secret and save.
6. If your deployed app uses a custom domain later, also add that domain to
   **Authentication → URL Configuration → Site URL** and
   **Redirect URLs** in Supabase (for local dev, `http://localhost:3000` is
   already allowed by default).

## 5. Add the env vars in Vercel

1. In Supabase, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Use the `anon` key, never the `service_role` key — the anon key is safe
   to ship in the browser because row-level security enforces the rules.)
2. In Vercel, open the project → **Settings → Environment Variables**, add
   both variables (all environments), and **redeploy** (Deployments → ⋯ →
   **Redeploy**).

## 6. Verify

1. Open the deployed app. You should land on the intro screen; complete
   onboarding.
2. In **Setup → Calendar**, click **Connect Google Calendar**, sign in with
   Google, and approve read-only calendar access.
3. Click **Import last 7 days** — you should see "Imported N events across
   D days". Imported days show as "adjusted" on the Today tab, and the
   header badge changes to "☁️ Synced".
4. In Supabase **Table Editor → day_blocks**, you should see rows for your
   user. If the import shows an error instead, it names the cause
   (most common: the Google consent screen is still in Testing and your
   account is not listed as a test user, or the calendar.readonly scope
   was not added to the OAuth consent screen).

## If Supabase is not configured

The app works without any of this: it runs entirely on localStorage, the
calendar section shows a clearly-labeled simulated toggle, and .ics file
import works with no account at all.
