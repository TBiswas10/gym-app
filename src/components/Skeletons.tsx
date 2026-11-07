import type { CSSProperties } from "react";

/** One grey block. Sizes come from the spacing tokens; the pulse (and its reduced-motion rule) is `.skeleton`. */
function Sk({ w = "100%", h = "var(--space-4)", style }: { w?: string; h?: string; style?: CSSProperties }) {
  return <span className="skeleton" style={{ display: "block", width: w, height: h, ...style }} />;
}

/** What shows while a tab loads: the same cards and tiles as the real screen, empty. It only appears after 300 ms (see `.skel-screen`). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="scroll skel-screen" aria-busy="true" aria-label="Loading">
      {children}
    </div>
  );
}

const Title = () => <Sk w="45%" h="var(--space-8)" />;

export function ProgressSkeleton() {
  return (
    <Shell>
      <Title />
      <section className="card">
        <Sk w="60%" h="var(--space-8)" />
        <Sk h="var(--space-2)" />
        <div className="grid3">{[0, 1, 2].map((i) => <div key={i} className="stat"><Sk w="60%" h="var(--space-6)" /><Sk w="80%" h="var(--space-3)" /></div>)}</div>
      </section>
      <div className="segmented"><Sk h="var(--size-tap)" style={{ gridColumn: "1 / -1", background: "none" }} /></div>
      <section className="card"><Sk w="40%" h="var(--space-6)" /><Sk h="calc(var(--size-cta) * 3)" /></section>
    </Shell>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Shell>
      <Title />
      <Sk h="var(--size-control)" />
      <div className="col g2">{Array.from({ length: rows }, (_, i) => <Sk key={i} h="var(--size-cta)" />)}</div>
    </Shell>
  );
}

export function TodaySkeleton() {
  return (
    <Shell>
      <Sk w="70%" h="var(--space-8)" />
      <Sk w="40%" h="var(--space-4)" />
      <section className="card"><Sk w="50%" h="var(--space-6)" /><Sk h="var(--space-4)" /><Sk h="var(--space-4)" /><Sk h="var(--size-cta)" /></section>
      <div className="grid3">{[0, 1, 2].map((i) => <Sk key={i} h="var(--size-cta)" />)}</div>
    </Shell>
  );
}
