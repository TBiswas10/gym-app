import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ problem?: string; deleted?: string }> }) {
  const { problem, deleted } = await searchParams;
  return (
    <LoginForm
      initialProblem={problem === "link" ? "That link didn’t work or has expired. Ask for a new one." : null}
      deleted={deleted === "1"}
    />
  );
}
