import Link from "next/link";
import { ComingSoon } from "@/components/ComingSoon";

export default function Page() {
  return (
    <div className="screen fill">
      <ComingSoon icon="dumbbell" title="Find your weight" body="Finding your starting weights arrives in the next step." />
      <div className="bottom-bar">
        <Link className="btn btn-primary btn-cta" href="/">Back to Today</Link>
      </div>
    </div>
  );
}
