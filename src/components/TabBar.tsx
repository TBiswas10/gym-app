"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TABS, tabIndex } from "@/lib/tabs";
import { Icon } from "./Icon";

export function TabBar() {
  const path = usePathname();
  const router = useRouter();
  // Light up the tab on touch-down, before the page has finished arriving.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  // Fetch every tab ahead of time so switching never waits.
  useEffect(() => {
    for (const t of TABS) router.prefetch(t.href);
  }, [router]);
  const active = tapped ?? TABS[Math.max(tabIndex(path), 0)].href;
  return (
    <nav className="tabbar" aria-label="Main" style={{ "--i": Math.max(0, TABS.findIndex((t) => t.href === active)) } as React.CSSProperties}>
      <span className="tab-ind" aria-hidden="true" />
      {TABS.map((t) => (
        <Link key={t.href} className="tab" href={t.href} prefetch aria-current={t.href === active ? "page" : undefined} onPointerDown={() => setTapped(t.href)}>
          <Icon name={t.icon} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
