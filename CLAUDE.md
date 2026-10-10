# Workout Tracker

Single-user iPhone PWA (installed from Safari to the Home Screen). Built from the design handoff in `design/` and the exported tokens.

## Stack
- Next.js 16 (App Router, TypeScript), React 19. `src/proxy.ts` replaces middleware (Next 16).
- Tailwind CSS **v3** (the exported `tailwind.config.js` is v3 format) + `src/styles/tokens.css` + `src/styles/components.css`.
- Supabase (Auth + Postgres + RLS) via `@supabase/ssr`. Hosting: Vercel.
- Fonts (Archivo, Figtree) are self-hosted in `src/app/fonts`. No third-party scripts, fonts, analytics or tracking.

## Plan facts (do not change)
Mon Push, Tue Pull, Wed Legs + Core, Thu Upper (light), Sat Lower + Core + Cardio, Fri and Sun rest.
All exercises are 2 sets. Cardio comes FIRST and is the warm-up (owner decision, replaces the old separate 7 min warm-up). Sessions capped at 45-50 min. Two plans: 5-day split and 3-day full body.
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

## Workout architecture (steps 4-6)
- `workout-state.ts` is the whole state of a session and every change to it (pure). `diffOps(a, b)` turns a change into
  server operations (`ops.ts`); undo is `diffOps(b, a)`. Operations are idempotent and validated by `ops-validate.ts`
  (the server also relies on RLS and DB constraints). `sync-queue.ts` + `useSync` keep a queue on the phone, so sets
  survive losing signal and are sent in order when the network returns.
- Timers (`timers.ts`): the session stores its start timestamp (workouts.started_at), rest stores its end time; both are
  recalculated from the clock every tick and on visibilitychange. Amber at 40:00, red at 50:00, Saturday-style cardio guard at 45:00.
- Progression (`progression.ts`): up only when the top of the range is hit on BOTH sets; weeks 1-2 and high soreness hold.
- Quick log (`parser.ts`): pure; always returns an entry to CONFIRM or a problem with fixes; pounds are offered, never auto-converted.
- `/workout` starts or resumes the single in-progress session (partial unique index). Start links use prefetch={false}.

## MCP server (step 7b, see docs/MCP.md)
- `/mcp` (stateless streamable HTTP, `@modelcontextprotocol/sdk`, zod). Auth = Supabase OAuth 2.1 access tokens (must carry
  `client_id`); `/.well-known/oauth-protected-resource` points clients at Supabase Auth; `/oauth/consent` is the approval page.
- The server acts AS the user (token-based client, RLS applies). No service-role key anywhere.
- Migration `mcp_hardening`: connector tokens cannot delete, change plan/settings/reviews or call account/plan functions
  (RESTRICTIVE policies on `auth.jwt() ->> 'client_id'`); `mcp_requests` = log + rate-limit counts.
- 15 tools now (added get_plan, list_exercises, get_schedule, get_settings, start_workout, finish_workout, edit_logged_sets). A wider-power migration (delete / plan edit / settings / schedule) is written in `supabase/pending/mcp_more_power.sql` and deliberately NOT applied.
- Root `src/app/loading.tsx` is the dark launch shell (same tile as the launch image) so the HTML flushes immediately on open.
- Read tools never write. Write tools (`log_sets`, `log_cardio`, `log_checkin`) are narrow, validated, replace-not-delete.

## Push, offline and errors (step 8)
- `public/sw.js`: offline fallback (`/offline`, never caches data pages), caches static files, shows push notifications.
  Registered in production only. `push_subscriptions` + `rest_timers` tables (RLS, closed to connector tokens).
- Rest alert flow: phone POSTs `/api/push/rest` {seconds,title,body} -> row in `rest_timers` -> `after()` waits, claims the row
  (pending -> sent) and sends with `web-push`; skip/undo POSTs `/api/push/cancel`. VAPID keys: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` (server only), `VAPID_SUBJECT` (the app URL, not an email).
- Push works only from the installed Home Screen app (iOS 16.4+) after a tap; denied/unsupported fall back to the on-screen timer.
- Friendly `error.tsx`, `global-error.tsx`, `not-found.tsx`, `(app)/loading.tsx`, offline banner; security headers in `next.config.ts`.

## Motion and feel (Apple-style polish, tokens only)
- Feedback on press (`:active`), never on release: buttons, tabs, sets all scale/tint instantly. `touch-action: manipulation` removes the tap delay.
- Sheets leave the way they arrived (`anim-out`, then unmount); scrim fades. Reduced motion swaps slides for short fades.
- Tabs never wait: all four are prefetched (`prefetch` + `router.prefetch`), `staleTimes.dynamic = 30s` keeps visited ones, no skeleton (`loading.tsx` removed), tap lights the tab on pointer-down. Every write action calls `revalidatePath("/", "layout")` so cached tabs never show old data.
- `SwipeTabs` (layout): swipe left/right between tabs (follows the finger, rubber-bands at the ends), pull down at the top to refresh. Logic in `src/lib/tabs.ts` (tested). Ignores fields and sideways-scrolling rows (`data-no-swipe` opts out).
- Keyboard: `KeyboardFit` (root layout) shrinks `.screen.fill` to the visible area (`--app-h`) while the keyboard is open and swaps the home-indicator padding for `--space-3`, so bottom bars and fields stay clear. Audit (ios-design craft checks): contrast of text/text-2/accent passes 4.5:1; text-3 (3.9:1) is used only on disabled controls; icon-only buttons have labels; focus rings present.
- `.screen.fill` is `position:fixed` on all four edges. iOS status bar style is `black` (solid strip): with `black-translucent` this iPhone gave the app a window 47pt (status bar height) shorter than the screen and left a dead gap under the tab bar (measured on a real device). The status bar style is read only when the app is added to the Home Screen, so changing it means re-adding the app. `--safe-top` = inset + space-6 (app.css). Tab swipes page like an iOS app: finger-follow, velocity-based throw-off, next tab slides in from the opposite side (`SwipeTabs`); `EdgeBack` gives the left-edge back swipe on Library guides and Reviews.
- Keyboard: `KeyboardFit` (root layout) shrinks the screen to the visible area (`--app-h`) while the keyboard is open and swaps the home-indicator padding for `--space-3`.
- Workout extras: rest ring with ±15 s (`extendRest`), haptics via a hidden `switch` checkbox (`haptics.ts`, Safari 17.4+, silent no-op elsewhere), Wake Lock keeps the screen on, stall banner (`stallCheck`: same weight 3 sessions, never both sets at top; advice only, rule unchanged). Progress has a Consistency card (`consistency()`). Library/guides show two swapping exercise photos (`ExerciseMedia`, files in `public/exercises`). Push failures now return the real code from `/api/push/test` and log `push-failed`.
- Set entry: tap the number to type it (`NumField`, number pad), chips "Same as last time" and "+increment" (`restoreLast`, `addKg`, `setValue`); quick log offers a one-tap "Same as last: lat pulldown 35kg 10 10". Today shrinks the setup note to one line after the first view (`wt.setupSeen`). Progress has Records (`records()`); finish screen shows one warm line (`encouragement()`). Hosting region is `icn1` (next to the Supabase DB in Seoul) via `vercel.json`; launch screens are served at `/splash/<w>x<h>` (iOS shows white without them).
- Pull to refresh (SwipeTabs): a circle drops in as you pull at the top of a tab, turns lime and taps (haptic) at the threshold (`PULL_THRESHOLD` = 90 px), spins while `router.refresh()` runs in a transition, then the page eases back. Verified on a real iPhone: MCP connector works, push alerts work, number pad / swipes / keyboard lift work.
- Session order is cardio (warm-up) -> lifts -> optional cool-down. Estimate = lifts + cardio (`estimateMinutes`). The workout X opens a sheet: Resume / End workout and check in / Leave for now. There is no separate find-weight step: Start goes straight to `/workout`; setup weeks only hold weights and the sets count (the `/find-weight` route still exists but is not linked).
- Test mode (Plan > Test mode, `program_state.test_mode`, `workouts.is_test`, migration `test_mode`): Today shows a card to start ANY template day (`/workout?test=<weekday>`) and preview week 4/8/12 check-ins; test sessions are flagged and `setTestMode(false)` deletes them (checkins first, since their workout_id is set null on delete).
- Finish: `/complete` opens as ONE huge tick (`.done-tick`, "Workout complete", stats, PBs, warm line) with Continue to the check-in; Today shows a "Workout complete" tick on done days. A skipped day (schedule override) can still be started ("Do it now") and shows a tick once done (`buildStrip` ignores the skip when the origin is completed); in a workout, finishing a skipped lift turns it into a tick (`logSet`). Lifts can be reordered from the checklist (`moveExercise`, "Change order").
- UI pass (rings + hero numbers): Today has weekly Activity-style rings (`Rings`, `ringFraction`: sessions / sets / cardio minutes in accent / info / success) and a Resume bar while a session is open (`ResumeBar`). Workout: hero numbers (`.num-hero`) you can scrub by dragging up/down (`NumField` + `scrubSteps`, haptic tick per step), bigger rest ring that pulses in the last 5 s, a "New best" card with before -> after on a PB, horizontal swipe on the card to move between lifts. Tab bar has one sliding indicator (`.tab-ind`). First launch shows a 4-card gesture tour (`GestureTour`, `wt.tourSeen`). Not built: sound, drag-sheet physics, shared-element transitions.
- Only `--dur-*` / `--ease-*` tokens; no new colours (so no translucent bars). No animation library added.

## Build order (stop after each step for testing)
1. Setup, PWA manifest + icons, Supabase login, tokens in Tailwind  (done, tested)
2. Database tables + RLS + seed  (applied to the gym-app Supabase project 2026-10-09, verified)
3. Install guide, notifications screen, Today screen  (done, tested)
4. Active workout (sets, last-time, rest + session timers, suggestions, undo, edit/delete)  (built and deployed, awaiting phone test)
5. Cardio cards  (built)
6. Chat quick-log (pure rule-based parser + confirmation card)  (built)
7. Progress charts, week 4/8/12 reviews, Plan editor, Library + form guides, CSV export, account deletion  (built and deployed, awaiting phone test)
7b. Remote MCP server in this app (streamable HTTP, official SDK, authenticated, rate limited, logged)  (built; needs Supabase OAuth server enabled, see docs/MCP.md)
8. Web push for rest-timer end, safe areas, offline + error states  (built and deployed, awaiting phone test)
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
