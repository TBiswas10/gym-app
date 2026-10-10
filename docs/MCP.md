# Workout Tracker as a Claude connector (MCP)

Lets Claude read and write your workout data. The server lives inside this app at `/mcp`
(streamable HTTP, official MCP TypeScript SDK).

## How it is secured
- **Sign-in:** OAuth 2.1 through Supabase Auth. Claude registers itself, you approve it on your own consent page
  (`/oauth/consent`), and Supabase issues a token for *you*. Every request must carry that token.
- **Acts as you, under RLS:** the server builds its database client from your token. The service-role key is never
  used or stored anywhere in this app.
- **Narrow powers, enforced by the database:** connector tokens (they carry a `client_id`) can read everything of
  yours and add or correct workouts, sets, cardio and check-ins. They **cannot delete anything, change your plan,
  settings or check-in choices, or touch your account**: row-level policies and the account/plan functions refuse them.
- **Narrow tools:** write tools take validated inputs (max 2 sets, weight 0-400 kg, reps 1-100, ...), only touch
  today's session, replace rather than delete, and return a summary of exactly what changed.
- **Rate limits:** 60 requests a minute and 20 writes a minute per user; repeated failed sign-ins per IP are blocked.
- **Request log:** every call is logged (method, tool, status, time, client) in the `mcp_requests` table (30 days)
  and in the Vercel logs. No request bodies or workout data are logged.

## Tools
| Tool | What it does |
|---|---|
| `get_today_workout` | Today's session (Sydney date): exercises, targets, last time, what to lift next, cardio, notes |
| `get_history` | Recent workouts with sets, cardio and check-ins (optionally one exercise) |
| `log_sets` | Log or correct up to 2 sets of one exercise in today's session; starts the session if needed |
| `log_cardio` | Log a machine cardio block, or a rest-day walk or stretch |
| `log_checkin` | Soreness, energy, notes, bodyweight |
| `get_progress` | Week, this week's totals and PBs, strength trend, soreness/energy trend, next check-in |
| `suggest_next_weights` | Next weights by the progression rule, with the reason |
| `get_review` | The week 4/8/12 check-in numbers and recommendation |
| `get_plan` | Your plan: each day's exercises (sets, reps) and cardio |
| `list_exercises` | The exercise library: slug, type, rep range, weight step and jump |
| `get_schedule` | This week's strip: done / today / missed / skipped, and what can still be done |
| `get_settings` | Alerts, bodyweight tracking, deload weeks, per-exercise jumps and notes |
| `start_workout` | Start today's session, or a skipped day from this week (by date) |
| `finish_workout` | Mark the session in progress as completed |
| `edit_logged_sets` | Correct set 1 / set 2 of one exercise in the session on a date (replaces, never removes) |

## One-time setup in Supabase (dashboard)
1. **Authentication > URL Configuration:** Site URL = `https://gym-app-one-xi.vercel.app` (your Vercel address).
2. **Authentication > OAuth Server:**
   - turn **Enable OAuth 2.1 server** on,
   - set **Authorization Path** to `/oauth/consent`,
   - turn **Allow dynamic OAuth app registration** on (Claude registers itself).
3. Optional but recommended: **Project Settings > JWT Keys**: move to an asymmetric signing key (ES256).

## Add it to Claude
**claude.ai / Claude desktop / mobile:** Settings > Connectors > **Add custom connector**
- Name: `Workout`
- URL: `https://gym-app-one-xi.vercel.app/mcp`
- Add, then **Connect**. You'll be sent to the app (log in if asked), see "Connect Claude?" and tap **Approve**.
- In a chat, enable the Workout connector from the tools menu.

**Claude Code:**
```bash
claude mcp add --transport http workout https://gym-app-one-xi.vercel.app/mcp
```
then run `/mcp`, choose `workout` and Authenticate.

To disconnect: remove the connector in Claude. In Supabase, Authentication > OAuth Server lists registered apps
and lets you delete them.

## Test checklist
1. [ ] `https://YOUR-APP/.well-known/oauth-protected-resource` shows JSON naming your Supabase `/auth/v1` as the sign-in server.
2. [ ] `curl -i -X POST https://YOUR-APP/mcp -H 'content-type: application/json' -d '{}'` answers **401** with a `WWW-Authenticate` header.
3. [ ] Add the connector. The consent screen names Claude and shows "It can / It can't". Approve.
4. [ ] Ask Claude: "What's my workout today?" It calls `get_today_workout` and the answer matches the app's Today screen.
5. [ ] "Show my last 2 weeks" calls `get_history`.
6. [ ] "Log chest press 30 kg for 12 and 12" calls `log_sets`. The reply lists set 1 and set 2 and says whether it's new or replaced. Open the app: the sets are there, and today's session is in progress.
7. [ ] Repeat with different reps: the old numbers are replaced (not duplicated).
8. [ ] "Log 3 sets" is refused (plan has 2). "Log pressing 30 kg" is refused as ambiguous, with options.
9. [ ] "Log 10 minutes on the bike, easy" and "Soreness 3, energy 4" both work and show in the app.
10. [ ] "What should I lift next time?" calls `suggest_next_weights` and the reasons match the rule (up only when both sets hit the top of the range).
11. [ ] "How's my progress?" and "Show my week 4 review" work.
12. [ ] "Delete my last workout" and "Change my plan" are things Claude has no tool for. Try asking it to anyway: it should say it can't.
13. [ ] In Supabase Table Editor, `mcp_requests` has a row per call; in Vercel Logs you see `{"evt":"mcp",...}` lines without any workout data.
14. [ ] Disconnect the connector, then ask again: Claude can't reach your data.


## More power (not applied yet)
Deleting logged data, editing the plan, changing settings and rescheduling days would need the connector's database
limits widened. That change is written but NOT applied: `supabase/pending/mcp_more_power.sql`. It was blocked by a security
check and needs an explicit yes from the owner. Account deletion and restarting the programme stay refused either way.
