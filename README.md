# Workout Tracker

A single-user workout tracker for iPhone, installed from Safari to the Home Screen. Next.js + Tailwind + Supabase.

## Local setup
Requires Node 20+ (tested on 24).

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

Open http://localhost:3000. Other scripts: `npm test` (unit tests), `npm run typecheck`, `npm run build`, `npm start`.

### Supabase (one-time)
1. Create a project at supabase.com.
2. Project settings > API: copy the **Project URL** and the **anon / publishable key** into `.env.local`.
   Never use the `service_role` key anywhere in this app.
3. Authentication > URL configuration: set **Site URL** to your Vercel URL and add these **Redirect URLs**:
   `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.
4. Create your account on the app's login screen (Create account tab), then in Authentication > Sign In / Providers
   turn **off** "Allow new users to sign up" so nobody else can register.
5. Email: the built-in Supabase email sender is fine for one user (low hourly limit).

### Database (migrations + seed)
Schema lives in `supabase/migrations` (applied in filename order); reference data is `supabase/seed.sql`
(safe to re-run). Never change the database by hand: add a new migration file instead.

Option A, Supabase CLI (recommended; tracks which migrations ran):
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF      # asks for your database password
npx supabase db push                                   # applies new migrations
```
Then load the seed by pasting `supabase/seed.sql` into the dashboard SQL Editor and running it.
Option B, no CLI: in the Supabase dashboard open SQL Editor and run each file in `supabase/migrations`
in order, then `supabase/seed.sql`.

## Environment variables
See `.env.example`. Real values live in `.env.local` (local) and Vercel project settings (deployed). Never commit them.

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public key; protected by row-level security |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | browser + server | Web push public key |
| `VAPID_PRIVATE_KEY` | server only | Web push private key. Secret. |
| `VAPID_SUBJECT` | server only | Contact URL for push services (your app's https URL) |

Later steps add VAPID keys (push) and MCP settings; they will be documented here.

## Deploy to Vercel
1. Push the repo to GitHub, then in Vercel choose **Add New > Project** and import it (framework: Next.js, no config needed).
2. Add the environment variables above (Production and Preview).
3. Deploy, then add the deployed URL to Supabase Site URL / Redirect URLs (see above).
4. On the iPhone, open the URL in **Safari** > Share > **Add to Home Screen**, then open it from the Home Screen.
   Web push only works once the app is installed this way (iOS 16.4+).

## Rest-timer notifications (web push)
The rest timer always counts down on screen. The notification when rest ends is sent by the server through web push.
- **It only works once the app is installed to the iPhone Home Screen** (Safari > Share > Add to Home Screen, iOS 16.4+),
  opened from that icon, and after you tap Allow on the Notifications screen (or turn on "Notify me when rest ends" in Plan).
  In a normal Safari tab iPhone does not offer web push at all.
- If you tap "Don't Allow", or later block it in iPhone Settings > Notifications > Workout, nothing breaks: the on-screen
  timer keeps working and the app explains how to turn alerts back on. Plan > "Send test" checks the whole chain.
- Keys: generate once with `node -e "const k=require('web-push').generateVAPIDKeys();console.log(k)"`, put them in
  `.env.local` and in Vercel (the private key is never committed or sent to the browser).
- No signal at the gym? Logged sets are kept on the phone and sent when you're back online. A screen that can't load shows
  the offline page.

## Use it from Claude
The app includes a remote MCP server so Claude can read and log your workouts. Setup steps and a test checklist: [docs/MCP.md](docs/MCP.md).

## Project layout
- `src/app` routes, `src/styles` design tokens + component CSS, `src/lib` helpers, `src/proxy.ts` session guard.
- `design/` design export reference. `tailwind.config.js` is the exported theme, used as-is.
- `CLAUDE.md` project rules and build order.

## Credits
Exercise photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), saved in `public/exercises/<slug>/0.jpg` and `1.jpg`.
