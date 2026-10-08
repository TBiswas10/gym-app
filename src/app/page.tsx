import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function logOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Temporary signed-in screen for step 1. The real Today screen arrives in step 3.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  return (
    <main className="screen fill">
      <div className="scroll">
        <div className="col g2" style={{ paddingTop: "var(--space-4)" }}>
          <span className="t-eyebrow c-accent">You’re in</span>
          <h1 className="t-display">Nice. Login works.</h1>
          <p className="t-body c-2">
            Signed in as <strong className="c-text">{email ?? "you"}</strong>. Today, workouts and the rest arrive in the next steps.
          </p>
        </div>
        <div className="card bg-surface text-ink">
          <span className="t-small c-2">Tailwind check: this card uses the token classes bg-surface and text-ink.</span>
        </div>
      </div>
      <form className="bottom-bar" action={logOut}>
        <button type="submit" className="btn btn-secondary btn-cta">Log out</button>
      </form>
    </main>
  );
}
