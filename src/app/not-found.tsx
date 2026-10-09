import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <span className="round round-subtle"><Icon name="info" /></span>
          <h1 className="t-title">We can’t find that</h1>
          <p className="t-body c-2">The page you were after isn’t here. Head back to Today.</p>
        </div>
      </div>
      <div className="bottom-bar"><Link className="btn btn-primary btn-cta" href="/">Back to Today</Link></div>
    </div>
  );
}
