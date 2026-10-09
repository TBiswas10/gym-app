import { NotifyForm } from "./NotifyForm";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const { problem } = await searchParams;
  return <NotifyForm saveProblem={problem === "save"} />;
}
