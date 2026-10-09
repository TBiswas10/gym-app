"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "calendar" },
  { href: "/progress", label: "Progress", icon: "chart" },
  { href: "/library", label: "Library", icon: "book" },
  { href: "/plan", label: "Plan", icon: "list-checks" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const current = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} className="tab" href={t.href} aria-current={current ? "page" : undefined}>
            <Icon name={t.icon} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
