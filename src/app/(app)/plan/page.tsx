import { ComingSoon } from "@/components/ComingSoon";
import { logOut } from "@/lib/auth-actions";

export default function PlanPage() {
  return (
    <ComingSoon icon="list-checks" title="Plan" body="The plan editor, settings and CSV export arrive in a later step.">
      <form action={logOut}>
        <button type="submit" className="btn btn-secondary">Log out</button>
      </form>
    </ComingSoon>
  );
}
