import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ problem?: string; deleted?: string; next?: string }> }) {
  const { problem, deleted, next } = await searchParams;
  // Only same-site paths, so a link can never send you somewhere else after login.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <LoginForm
      initialProblem={problem === "link" ? "That link didn’t work or has expired. Ask for a new one." : null}
      deleted={deleted === "1"}
      next={safeNext}
    />
  );
}
