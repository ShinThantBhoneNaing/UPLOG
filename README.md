<p align="center">
  <img src="public/brand/uplog-brandsheet.png" alt="UPLOG" width="420" />
</p>

# UPLOG

**Plan. Share. Get things done.**

UPLOG is your team's internal work platform: log daily work, track tasks on a
board or list, organize projects, and see what everyone is building — in
seconds. Built with Next.js 16, TypeScript (strict), Tailwind CSS 4,
shadcn/ui, and Supabase (Postgres + Auth + Storage + Realtime).

---

## Quick start

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) (or run
`supabase start` locally with the CLI).

### 2. Run the database migrations

Open **SQL Editor** in the Supabase dashboard and run the files in
`supabase/migrations/` **in order**:

| File | What it creates |
|---|---|
| `00001_schema.sql` | Enums, tables, indexes, foreign keys |
| `00002_functions.sql` | Role helpers, activity/notification/audit triggers, search, views |
| `00003_rls.sql` | Row Level Security policies + realtime publication |
| `00004_storage.sql` | `attachments` (private) and `avatars` (public) buckets + policies |

With the Supabase CLI instead: `supabase db push` (or `supabase migration up`).

**Optional — deadline notifications:** enable the `pg_cron` extension
(Dashboard → Database → Extensions). `00002` auto-schedules
`notify_due_soon()` daily at 06:00 UTC when pg_cron is available.

### 3. (Optional) Seed demo data

Run `supabase/seed.sql` in the SQL Editor. Demo accounts (password
`uplog-demo-2026`):

| Email | Role |
|---|---|
| `alex@uplog.dev` | admin |
| `sarah@uplog.dev` | manager |
| `john@uplog.dev` | member |
| `mike@uplog.dev` | member |

Remove all seed data later with the delete statements listed at the top of
`seed.sql`.

### 4. Configure the app

```bash
cp .env.example .env.local
```

Fill in the values from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Only the anon key is ever used — the service-role key is **never** required by
this app and must never be added to it.

In **Authentication → URL Configuration** set the Site URL (and, for
production, add your domain to the redirect allow-list) so password-reset
emails link back correctly.

### 5. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — register an account or sign in with a demo user.
The **first registered user is a `member`**; promote yourself to admin once in
the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@company.com';
```

---

## Security model

Authorization lives in **Postgres RLS** — the UI's role checks are cosmetic.

- Every table has RLS enabled. Active, authenticated teammates can read
  workspace data (team transparency is the product); writes are constrained
  per table (own tasks/comments/updates, manager/admin for projects & user
  management).
- `activities`, `notifications`, and `audit_logs` have **no client insert
  policies** — they are written exclusively by `SECURITY DEFINER` triggers,
  so the feed and audit log can't be forged or forgotten.
- A `BEFORE UPDATE` trigger on `profiles` blocks non-admins from changing
  `role` / `is_active` / `email` (column-level guard on top of RLS), and
  writes audit entries for sensitive changes.
- Disabling a user (`is_active = false`) locks them out **immediately** via
  `is_active_user()` in every policy — no waiting for JWT expiry.
- Storage: attachments live in a private bucket under
  `<uploader-id>/<task-id>/…` with size/MIME limits enforced by the bucket
  *and* the app; downloads use short-lived signed URLs.
- History survives deletion: activity rows keep denormalized titles in
  `metadata` while task/project FKs go `NULL` on delete.

### Admin user creation

Teammates self-register at `/register`; admins then assign roles in
**Admin → Users**. Creating accounts *for* others requires the service-role
key, which this app deliberately never touches — use the Supabase dashboard
(Authentication → Users → Invite) for that flow.

## Architecture notes

- **Server Components** fetch data (parallel `Promise.all` rounds); mutations
  are **Server Actions** validated with Zod → Supabase (RLS enforced) →
  `refresh()`.
- **Optimistic UI** on the Kanban board: drag persists via server action and
  reverts on failure; fractional `position` column avoids reindexing.
- **Search** is one `search_all()` RPC over generated `tsvector` columns
  (GIN-indexed) — a single round-trip for the ⌘K palette.
- **Realtime** is used only where it earns its keep: the notification bell.
- Views `project_stats` and `member_workload` (both `security_invoker`) power
  dashboards and reports without denormalized counters.
- The data model is AI-ready: activities/daily updates carry enough
  structured context to answer "what did X work on last week?" via SQL.

## Project structure

```
supabase/
  migrations/        SQL migrations (schema, functions, RLS, storage)
  seed.sql           demo data (easily removable)
src/
  app/               routes: (auth) public pages, (app) authenticated shell
  components/        shared UI (shadcn/ui in components/ui)
  features/          auth, shell, tasks, projects, daily, activity, history,
                     reports, admin, settings — components + server actions
  lib/               supabase clients, validations, utils
  types/             database types (hand-maintained to match migrations)
  proxy.ts           session refresh + optimistic auth redirects (Next 16)
```

## Scripts

```bash
npm run dev      # develop
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
npx tsc --noEmit # typecheck
```

## Deployment (Vercel)

1. Push the repo to Git and import it in Vercel.
2. Set the three environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL=https://your-domain`).
3. Update the Supabase Auth Site URL / redirect list to the production domain.


## Collaborators
ShinThantBhoneNaing [ pinkkuu ]
Khit Thit [ mytx ]
