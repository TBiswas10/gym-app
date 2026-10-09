import Link from "next/link";
import { Icon } from "@/components/Icon";

type Props = { state: "bad" } | { state: "ask"; id: string; client: string; host: string };

export function ConsentView(props: Props) {
  if (props.state === "bad") {
    return (
      <div className="screen fill">
        <div className="scroll">
          <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
            <span className="round round-warning"><Icon name="triangle-alert" /></span>
            <h1 className="t-title">This link didn’t work</h1>
            <p className="t-body c-2">Start the connection again from Claude. If it keeps happening, check that the OAuth server is on in Supabase.</p>
          </div>
        </div>
        <div className="bottom-bar"><Link className="btn btn-primary btn-cta" href="/">Back to Today</Link></div>
      </div>
    );
  }

  return (
    <form className="screen fill" action="/api/oauth/decision" method="post">
      <input type="hidden" name="authorization_id" value={props.id} />
      <div className="scroll">
        <div className="col g3" style={{ paddingTop: "var(--space-4)" }}>
          <span className="round round-accent" style={{ width: 56, height: 56, borderRadius: "var(--radius-md)" }}><Icon name="dumbbell" size={32} /></span>
          <h1 className="t-display">Connect {props.client}?</h1>
          <p className="t-body c-2">
            {props.client}{props.host ? ` (${props.host})` : ""} wants to use your workout tracker. You can disconnect it at any time.
          </p>
        </div>

        <section className="card">
          <span className="t-eyebrow c-accent">It can</span>
          <div className="col g3">
            <span className="row g3 start"><span className="c-accent"><Icon name="circle-check" size={20} /></span><span className="t-small">Read your workouts, plan and progress.</span></span>
            <span className="row g3 start"><span className="c-accent"><Icon name="circle-check" size={20} /></span><span className="t-small">Log sets, cardio and check-ins in today’s session.</span></span>
          </div>
        </section>
        <section className="card">
          <span className="t-eyebrow c-2">It can’t</span>
          <div className="col g3">
            <span className="row g3 start"><span className="c-2"><Icon name="x" size={20} /></span><span className="t-small">Delete anything.</span></span>
            <span className="row g3 start"><span className="c-2"><Icon name="x" size={20} /></span><span className="t-small">Change your plan, settings or check-in choices.</span></span>
            <span className="row g3 start"><span className="c-2"><Icon name="x" size={20} /></span><span className="t-small">Touch your login or delete your account.</span></span>
          </div>
        </section>
        <div className="banner banner-info"><Icon name="info" /><span>Only approve this if you started the connection yourself, from Claude.</span></div>
      </div>
      <div className="bottom-bar">
        <button type="submit" name="decision" value="approve" className="btn btn-primary btn-cta">Approve</button>
        <button type="submit" name="decision" value="deny" className="btn btn-secondary btn-block">Not now</button>
      </div>
    </form>
  );
}
