import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <div className="screen fill">
      <ComingSoon icon="dumbbell" title="Active workout" body="Logging sets, the rest timer and the session timer arrive in the next step." />
      <div className="bottom-bar">
        <Link className="btn btn-primary btn-cta" href="/">Back to Today</Link>
      </div>
    </div>
  );
}
