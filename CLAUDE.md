# Workout Tracker

Single-user iPhone PWA (Home Screen from Safari), also usable on a laptop. Next.js 16 (App Router, TS), React 19, Tailwind v3 + CSS tokens, Supabase (Auth, Postgres, RLS), Vercel. Production: https://gym-app-one-xi.vercel.app (project `gym-app`, team tirtha-biswas-projects, Supabase ref `yvamsbkfjpgwssporklz`). Repo TBiswas10/gym-app is PUBLIC.

Full feature and architecture notes live in `docs/FEATURES.md` (read it when touching a feature; it is long on purpose). Update the matching bullet there when behaviour changes, and keep THIS file short.

## Commands
- Check everything: `bash scripts/check.sh` (types, lint, tests). Build: `npm run build`. Single test: `npx vitest run path`.
- Ship: use the `ship-gym-app` skill (checks, commit, push, `vercel deploy --prod --yes`, verify `/api/version` equals HEAD).
- Database changes: `supabase-change` skill. Exercise animations: `render-exercise` skill (Blender 5.2 headless, `scripts/exercise-renders`).

## Plan facts (never change)
Mon Push, Tue Pull, Wed Legs + Core, Thu Upper (light), Sat Lower + Core + Cardio, Fri and Sun rest. All exercises 2 sets. Cardio at the END. Sessions 45-50 min. 12 weeks: 1-2 find your weight, 3-12 build; check-ins 4, 8, 12.

## Rules that are easy to break
- Styling ONLY from tokens (`tailwind.config.js`, `src/styles/tokens.css`, `components.css`; one-offs in `screens.css`). No new colours, sizes, radii, fonts, hex values.
- RLS on every table; no service-role key anywhere; `NEXT_PUBLIC_*` only the Supabase URL and anon key; never commit `.env*`. Store only login email and workout data.
- Friendly error messages, never raw error text. Times stored UTC, shown Australia/Sydney ("today" = Sydney date). Weights in kg.
- Progression: weight goes up only when the top of the rep range is hit on BOTH sets; +2.5 kg upper, +5 kg legs, rounded to real steps.
- Schema only via versioned migrations applied with the Supabase MCP. Regenerate `database.types.ts` after each.
- Ask before adding a dependency or making a large decision. Commit after each working step.
- ESLint is not used (typescript-eslint does not support TS 7); lint is oxlint. Python/Blender output (`_renders/`, `__pycache__`) is never committed; the CC0 base body mesh is never in the repo.

## Quality bar (what "not slop" means here)
- Verify before claiming done: run the checks and LOOK at the result (screenshot or rendered frame). Report what was NOT verified (usually the phone). Never say "looks good" about an image you have not opened.
- Match the surrounding code: its comment density, naming, idiom. No speculative abstractions, no unrequested features, no dead code, no comments that restate the code.
- Copy is plain and honest: no invented numbers or percentages, no hype. Fix root causes, never suppress errors.
- After two failed corrections on the same problem, stop and rethink from scratch instead of patching again.
