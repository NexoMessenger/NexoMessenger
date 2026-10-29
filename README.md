# NEXO Messenger

Premium black glassmorphism messenger — React + TypeScript + Vite, with **Supabase** (Auth, PostgreSQL, Realtime, Storage) as the production backend.

## Quick starttest

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

The app uses `HashRouter` and a relative Vite `base`, so the production build can later be deployed to **GitHub Pages** or any static host without rewrite rules.

## Backend modes

| Mode | When | Behaviour |
|---|---|---|
| **Supabase (production)** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | Real accounts, PostgreSQL storage, realtime sync, file storage, Google OAuth |
| **Local Demo Mode** | No env keys | Fully usable demo in this browser only (localStorage + cross-tab sync). A warning banner is always shown. Passwords are SHA-256 hashed (never plain text); the seeded assistant replies locally. This mode exists so the UI can be previewed before keys exist — it is **not** a production backend. |

Demo account (Local Demo Mode only): `demo@nexo.app` / `demo1234`

## Own website server (self-hosted, e.g. http://31.77.169.93)

The project can run as a real website on your own server — no Supabase and no
browser-local data. One Node process serves the site **and** stores accounts,
sessions, messages and files on the server (`server/data/`), with WebSocket
realtime. People on different devices find each other by `@username` and see
the same groups.

```bash
git pull                 # or clone the repo
npm ci
npm run build:server     # builds the frontend in website mode
PORT=80 node server/index.mjs
```

Then open `http://<server-ip>/`. Users register once on the site; demo
accounts from Local Demo Mode do not migrate (they lived in browsers).

Run it permanently with PM2 (`pm2 start ecosystem.config.cjs`) or systemd
(`deploy/nexo.service`). Keep `server/data/` backed up — that folder **is**
the database. Never commit it and never expose it over HTTP (the server only
serves `dist/` and `/api/files/<random-name>` uploads).

### По-русски, коротко

1. На сервере: `git pull`, `npm ci`, `npm run build:server`
2. Запуск: `PORT=80 node server/index.mjs` (или `pm2 start ecosystem.config.cjs`)
3. Сайт открывается как `http://31.77.169.93/` — все регистрируются заново один раз,
   дальше поиск по `@username`, лички и группы работают между реальными людьми.
4. Папка `server/data/` — это вся база. Делай её бэкапы.

## Make friends visible to each other (required for real use)

If people on **different phones** cannot find each other by `@username` and
do not see each other's group messages, the live site is running in
**Local Demo Mode** — every device keeps its own private copy of the data and
nothing syncs between phones. The fix is connecting the shared backend once:

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run these files in order: `001_init.sql`,
   `002_language.sql`, `003_reactions_media_stickers.sql`,
   `004_cross_user_sync.sql` (from `supabase/migrations/`).
3. In Supabase → **Project Settings → API**, copy the **Project URL** and the
   **anon public** key (never the `service_role` key).
4. In GitHub → repo **Settings → Secrets and variables → Actions →
   Variables**, add two repository variables: `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
5. Re-deploy: push to `main` or run the “Deploy NEXO Messenger to GitHub
   Pages” workflow manually. The workflow log prints the detected backend
   mode, and the app's Profile/Settings screens show
   “Backend: Supabase” when connected.

After that, everyone registers **once more** on the live site (Local Demo
accounts live only in each phone's browser and do not migrate), and then
search by `@username`, direct chats and shared groups sync in realtime.

## Supabase setup (production)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL:** run `supabase/migrations/001_init.sql` in the SQL Editor (creates tables, indexes, unique-username constraint, RLS policies, realtime publication, `attachments`/`avatars` storage buckets, and the signup profile trigger).
3. **Keys:** copy `.env.example` → `.env.local` and fill in your project URL + **anon** key (Project Settings → API). Never commit `.env.local`; never put the `service_role` key in frontend code.
4. **Auth:** Authentication → Providers → Email (enable). For realtime, ensure the migration's `supabase_realtime` publication step succeeded.

### Google OAuth setup (exact steps)

Google sign-in is real — it is never faked. Until these steps are done, the Google button returns an honest configuration error.

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create **OAuth 2.0 Client ID (Web)**.
2. Add Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Supabase Dashboard → Authentication → Providers → **Google**: enable, paste Client ID + Client Secret.
4. Supabase → Authentication → URL Configuration: add your app URLs to Redirect URLs, e.g. `http://localhost:5173/**` and your production URL (GitHub Pages URL).

New Google users get a profile automatically (username derived from their email/name, editable in Profile — duplicates are rejected by the DB unique constraint).

## Features

- **Auth:** email/password sign-up & sign-in, Google OAuth (once configured), password reset via email, persistent sessions, protected routes, unique `@username` (DB-enforced), profiles with avatar/bio/online status.
- **Chats:** user search, 1-to-1 conversations, realtime messages, timestamps, unread counts, read ticks, typing indicators (throttled, auto-timeout), presence heartbeat (offline on sign-out/tab close).
- **Groups:** create public/private groups, add members, owner/admin/member roles, member management, leave group, sender names, realtime.
- **Channels:** public/private channels, subscribe/unsubscribe, subscriber counts, owner/admin/authorized-poster publishing enforced by RLS (`can_post_to_channel`), chronological posts.
- **Search:** people / public groups / public channels via backend queries with limits.
- **Attachments:** image preview + file download, type/size validation (25 MB Supabase / 2.5 MB local demo), upload progress & error states, Supabase Storage (private `attachments`, public `avatars` buckets).
- **Settings:** persisted theme (NEXO Glass / Midnight / Graphite), notification preference, profile privacy — all saved to `user_settings`.
- **Mobile:** bottom navigation, safe-area insets, touch targets, no horizontal overflow; architecture (PWA-friendly static build) can later be packaged for Android (e.g. Capacitor) — no APK is claimed here.

## Project structure

```
src/
  lib/        supabase client, API facade (Supabase ⇄ local demo), auth context, types
  components/ layout/nav, composer, shared UI (avatar, modal, user picker)
  pages/      auth, chats, chat room, groups, group room, channels, channel room, search, profile, settings
supabase/migrations/001_init.sql   schema + RLS + storage + realtime
.env.example                       placeholder keys only — no secrets in git
```

## Live demo (GitHub Pages)

Published automatically from `main` by `.github/workflows/deploy-pages.yml`:
**https://nexomessenger.github.io/NexoMessenger/** — demo login `demo@nexo.app` / `demo1234`.

Without Supabase repository Variables the published site runs in Local Demo Mode.
To switch it to the real backend, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
under Settings → Secrets and variables → Actions → **Variables**, then re-run the
"Deploy NEXO Messenger to GitHub Pages" workflow (every push to `main` also redeploys).

## Security notes

- Row Level Security on every table: users cannot read private conversations/groups they don't belong to, cannot post to channels without authorization, cannot edit other profiles, and cannot self-grant admin roles (role changes require owner/admin policies).
- Only the anon key ships in the frontend. Passwords are handled by Supabase Auth (production) — never stored in app tables.
```
