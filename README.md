# Workout Tracker

A single-user workout tracker for iPhone, installed from Safari to the Home Screen. Next.js + Tailwind + Supabase.

## Local setup
Requires Node 20+ (tested on 24).

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

Open http://localhost:3000. Other scripts: `npm run typecheck`, `npm run build`, `npm start`.

### Supabase (one-time)
1. Create a project at supabase.com.
2. Project settings > API: copy the **Project URL** and the **anon / publishable key** into `.env.local`.
   Never use the `service_role` key anywhere in this app.
3. Authentication > URL configuration: set **Site URL** to your Vercel URL and add these **Redirect URLs**:
   `http://localhost:3000/auth/callback` and `https://YOUR-APP.vercel.app/auth/callback`.
4. Create your account on the app's login screen (Create account tab), then in Authentication > Sign In / Providers
   turn **off** "Allow new users to sign up" so nobody else can register.
5. Email: the built-in Supabase email sender is fine for one user (low hourly limit).

## Environment variables
See `.env.example`. Real values live in `.env.local` (local) and Vercel project settings (deployed). Never commit them.

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public key; protected by row-level security |

Later steps add VAPID keys (push) and MCP settings; they will be documented here.

## Deploy to Vercel
1. Push the repo to GitHub, then in Vercel choose **Add New > Project** and import it (framework: Next.js, no config needed).
2. Add the environment variables above (Production and Preview).
3. Deploy, then add the deployed URL to Supabase Site URL / Redirect URLs (see above).
4. On the iPhone, open the URL in **Safari** > Share > **Add to Home Screen**, then open it from the Home Screen.
   Web push only works once the app is installed this way (iOS 16.4+).

## Project layout
- `src/app` routes, `src/styles` design tokens + component CSS, `src/lib` helpers, `src/proxy.ts` session guard.
- `design/` design export reference. `tailwind.config.js` is the exported theme, used as-is.
- `CLAUDE.md` project rules and build order.
