"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";

type Mode = "login" | "create";
type Method = "password" | "magic";

const linkBtn = { background: "none", border: 0, padding: 0 } as const;

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don’t match. Try again, or use a magic link.";
  if (m.includes("already registered")) return "That email already has an account. Switch to Log in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "New accounts are switched off. Log in with your existing account.";
  if (m.includes("email not confirmed")) return "Check your inbox for the confirmation link first.";
  if (m.includes("fetch") || m.includes("network")) return "Can’t reach the server. Check your connection and try again.";
  return "Something went wrong. Try again in a moment.";
}

export function LoginForm({ initialProblem, deleted = false, next = "/" }: { initialProblem: string | null; deleted?: boolean; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [sent, setSent] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(initialProblem);

  const login = mode === "login";
  const pwm = method === "password";
  const emailOk = email.indexOf("@") > 0;
  const pwOk = pw.length >= 8;
  const badE = tried && !emailOk;
  const badP = tried && pwm && !pwOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (!emailOk || (pwm && !pwOk)) {
      setTried(true);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
    try {
      if (!pwm) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: !login },
        });
        if (error) throw error;
        setSent(true);
      } else if (login) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else setSent(true);
      }
    } catch (err) {
      setProblem(friendly(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  const headline = sent ? "Almost there." : login ? "Welcome back." : "Let’s get you set up.";
  const cta = !pwm ? "Email me a link" : login ? "Log in" : "Create account";

  return (
    <form className="screen fill" onSubmit={submit} noValidate>
      <div className="scroll">
        <div className="col g3" style={{ paddingTop: "var(--space-4)" }}>
          <span className="round round-accent" style={{ width: 56, height: 56, borderRadius: "var(--radius-md)" }}>
            <Icon name="dumbbell" size={32} />
          </span>
          <h1 className="t-display">{headline}</h1>
          <p className="t-body c-2">Short sessions. Simple tracking. 45 to 50 minutes, start to finish.</p>
        </div>

        {deleted && (
          <div className="banner banner-success" role="status">
            <Icon name="circle-check" />
            <span><b>Your account is deleted.</b> Everything was removed.</span>
          </div>
        )}

        {!sent && (
          <div className="col g4" style={{ marginTop: "var(--space-2)" }}>
            <div className="segmented" role="tablist" aria-label="Account">
              <button type="button" className="seg" role="tab" aria-selected={login} onClick={() => setMode("login")}>
                Log in
              </button>
              <button type="button" className="seg" role="tab" aria-selected={!login} onClick={() => setMode("create")}>
                Create account
              </button>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="email">Email</label>
              <input
                className={`input ${badE ? "is-error" : ""}`}
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setTried(false);
                }}
                placeholder="you@example.com"
                aria-invalid={badE}
              />
              {badE && (
                <span className="field-error" role="alert">
                  <Icon name="circle-alert" size={16} />
                  Add an @ to your email address.
                </span>
              )}
            </div>

            {pwm ? (
              <div className="field">
                <label className="field-label" htmlFor="pw">Password</label>
                <div className="input-wrap">
                  <input
                    className={`input ${badP ? "is-error" : ""}`}
                    id="pw"
                    type={showPw ? "text" : "password"}
                    autoComplete={login ? "current-password" : "new-password"}
                    value={pw}
                    onChange={(e) => {
                      setPw(e.target.value);
                      setTried(false);
                    }}
                    placeholder="At least 8 characters"
                    aria-invalid={badP}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    <Icon name={showPw ? "eye-off" : "eye"} />
                  </button>
                </div>
                {badP && (
                  <span className="field-error" role="alert">
                    <Icon name="circle-alert" size={16} />
                    Use at least 8 characters.
                  </span>
                )}
                {login && (
                  <button
                    type="button"
                    className="link"
                    style={{ alignSelf: "flex-start", ...linkBtn }}
                    onClick={() => {
                      setMethod("magic");
                      setTried(false);
                    }}
                  >
                    Forgot it? Use a magic link
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="banner banner-info">
                  <Icon name="mail" />
                  <span>We’ll email you a one-time link. No password to remember.</span>
                </div>
                <button
                  type="button"
                  className="link"
                  style={{ alignSelf: "flex-start", ...linkBtn }}
                  onClick={() => {
                    setMethod("password");
                    setTried(false);
                  }}
                >
                  Use a password instead
                </button>
              </>
            )}

            {problem && (
              <div className="banner banner-danger" role="alert">
                <Icon name="circle-alert" />
                <span>{problem}</span>
              </div>
            )}
          </div>
        )}

        {sent && (
          <section
            className="card card-raised anim-pop"
            style={{ padding: "var(--space-6)", alignItems: "flex-start", borderRadius: "var(--radius-lg)" }}
          >
            <span className="round round-accent">
              <Icon name="mail" />
            </span>
            <h2 className="t-title">Check your inbox</h2>
            <p className="t-body c-2">
              We sent a link to <strong className="c-text">{email}</strong>. Open it on this phone and you’re in.
            </p>
            <button type="button" className="link" style={linkBtn} onClick={() => setSent(false)}>
              Wrong email? Go back
            </button>
          </section>
        )}
      </div>

      <div className="bottom-bar">
        {!sent && (
          <button type="submit" className={`btn btn-primary btn-cta ${busy ? "is-loading" : ""}`} disabled={busy}>
            {cta}
          </button>
        )}
        <p className="t-small c-2" style={{ textAlign: "center" }}>
          Just for you. Your data stays on your account.
        </p>
      </div>
    </form>
  );
}
