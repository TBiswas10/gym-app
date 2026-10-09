# Workout Tracker

Single-user iPhone PWA (installed from Safari to the Home Screen). Built from the design handoff in `design/` and the exported tokens.

## Stack
- Next.js 16 (App Router, TypeScript), React 19. `src/proxy.ts` replaces middleware (Next 16).
- Tailwind CSS **v3** (the exported `tailwind.config.js` is v3 format) + `src/styles/tokens.css` + `src/styles/components.css`.
- Supabase (Auth + Postgres + RLS) via `@supabase/ssr`. Hosting: Vercel.
- Fonts (Archivo, Figtree) are self-hosted in `src/app/fonts`. No third-party scripts, fonts, analytics or tracking.

## Plan facts (do not change)
Mon Push, Tue Pull, Wed Legs + Core, Thu Upper (light), Sat Lower + Core + Cardio, Fri and Sun rest.
All exercises are 2 sets. 7 min warm-up. Sessions capped at 45-50 min. Two plans: 5-day split and 3-day full body.
12-week programme: weeks 1-2 find your weight, weeks 3-12 build. Check-ins at weeks 4, 8, 12.

## Design token rule
Styling comes ONLY from `tailwind.config.js`, `src/styles/tokens.css` and the classes in `src/styles/components.css`.
No new colours, sizes, radii or fonts. Use `var(--token)` in any inline style. One-off literals that the design
screens themselves use go in one marked file and are listed for review. Never invent hex values.
`src/lib/tokens.ts` reads token values from the Tailwind config for non-CSS uses (icons, manifest).

## Security rules
- RLS on every table; only the signed-in user can read or write their rows.
- Secrets only in server-side env vars. `NEXT_PUBLIC_*` is only the Supabase URL and anon key (safe by design with RLS).
- Never use or expose a service-role key. Never commit `.env*` (except `.env.example`).
- Friendly error messages in the design's tone; never show raw error text.
- Privacy: store only login email and workout data.

## Data rules
- Timestamps stored in UTC, displayed in Australia/Sydney. "Today" = the Sydney local date.
- Weights stored in kg. Pounds only converted after the user confirms.
- Schema changes only through versioned SQL migrations in `supabase/migrations` (never edit the DB by hand).

## Progression rules
Suggest a higher weight only when the top of the rep range is hit on BOTH sets, otherwise hold.
+2.5 kg upper body, +5 kg legs, rounded to real steps (dumbbells 2 kg, 1 kg for lateral raise/hammer curl,
machine stacks 2.5 or 5 kg); increments editable per exercise. Soreness 4-5 for 3 sessions in a row: suggest hold/light.
Deload suggestion around week 7 (half the sets). Check-in "Add a set" was dropped: all exercises stay at 2 sets.

## Database (supabase/migrations + supabase/seed.sql)
- Global, read-only: `exercises` (17, with form guides and progression steps). Templates: `program_templates`,
  `template_days`, `template_exercises` hold built-ins (`user_id is null`) and the user's own editable copy
  (made by `start_program()` / `clone_template()`).
- User-owned (RLS `user_id = auth.uid()`): `program_state` (+ view `program_state_view` with derived `current_week`),
  `user_exercise_settings`, `schedule_overrides` (skipped/moved/light days), `workouts`, `sets`, `cardio_entries`,
  `checkins` (soreness/energy/bodyweight), `reviews` (weeks 4/8/12: build | hold | deload).
- Child rows reference `(workout_id, user_id)`, so a row can never point at someone else's workout.
- `sets.set_number` is 1 or 2 (plan fact). Client-generated UUIDs make offline retries idempotent.
- `delete_my_account()` (SECURITY DEFINER, own account only) cascades all data. No service-role key anywhere.
- Current week is derived from `start_date` and the Sydney date, never stored, so it cannot drift.
- Migrations are applied through the Supabase MCP (`apply_migration`); the file name must use the version the DB records
  (see `list_migrations`) so the repo and DB history match. Seed data is applied with `execute_sql`.
- Later migrations: `push_subscriptions` (step 8), MCP rate limit + request log (step 7b).

## App structure and rules from step 3
- Routes: `(app)/` has the tab bar (Today `/`, `/progress`, `/library`, `/plan`); `/install` and `/notifications` are onboarding;
  `/workout` and `/find-weight` are placeholders until step 4. First sign-in with no `program_state` goes
  `/` -> `/install` -> `/notifications` -> `completeOnboarding()` (starts the 5-day plan from today, Sydney date).
- Schedule model (`src/lib/schedule.ts`): a session is identified by its ORIGIN date; a move puts it on another slot date
  in the same week; workouts are recorded against the origin date. `schedule_overrides` holds skipped / moved / light.
- Pure, tested logic lives in `src/lib` (`dates`, `plan`, `schedule`); screens only render it. `npm test` runs vitest
  (also server-renders TodayView with fixtures for the design's states).
- `src/lib/database.types.ts` is generated from the live schema (regenerate after each migration).
- One-off design styles that are not in components.css live ONLY in `src/styles/screens.css` (review list for the token rule).
- Server actions are the only write path for Today (RLS applies); optimistic UI via `useOptimistic`.

## Build order (stop after each step for testing)
1. Setup, PWA manifest + icons, Supabase login, tokens in Tailwind  (done, tested)
2. Database tables + RLS + seed  (applied to the gym-app Supabase project 2026-10-09, verified)
3. Install guide, notifications screen, Today screen  **<- done, awaiting test**
4. Active workout (sets, last-time, rest + session timers, suggestions, undo, edit/delete)
5. Cardio cards
6. Chat quick-log (pure rule-based parser + confirmation card)
7. Progress charts, week 4/8/12 reviews, Plan editor, Library + form guides, CSV export, account deletion
7b. Remote MCP server in this app (streamable HTTP, official SDK, authenticated, rate limited, logged)
8. Web push for rest-timer end, safe areas, offline + error states
9. Optional: server-side LLM call for messy chat input

## Working rules
- Ask before making large decisions or adding dependencies. Keep dependencies minimal; explain any new one first.
- Commit after each working step. Run tests (and typecheck/build) before each commit.
- Unit tests for progression, parser, timer calculation and date logic (vitest, added at step 3).
- Each step ends with: matches the design using only tokens, tests pass, no console errors, RLS on new tables,
  and a short summary + manual test checklist for the user.
- Keep this file updated as we go.

## Notes
- Deployed to Vercel (project `gym-app`, team tirtha-biswas-projects) by CLI: `vercel deploy --prod`. Production URL
  https://gym-app-one-xi.vercel.app . Env vars (the two NEXT_PUBLIC_SUPABASE_* values) are set in Vercel for Production.
  The GitHub repo (TBiswas10/gym-app) is PUBLIC and nothing has been pushed to it; ask before pushing.
- `design/Workout Tracker.html` (11 MB bundled design export) is gitignored; `design/tokens.json` is committed.
- Design deviation: `.screen` is fixed 390x844 in the design; the app uses `.screen.fill` (100% x 100dvh).
