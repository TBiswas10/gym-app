import { Icon, type IconName } from "./Icon";

// Placeholder for screens that arrive in a later build step.
export function ComingSoon({ title, body, icon, children }: { title: string; body: string; icon: IconName; children?: React.ReactNode }) {
  return (
    <div className="scroll">
      <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
        <span className="round round-subtle">
          <Icon name={icon} />
        </span>
        <h1 className="t-title">{title}</h1>
        <p className="t-body c-2">{body}</p>
        {children}
      </div>
    </div>
  );
}
