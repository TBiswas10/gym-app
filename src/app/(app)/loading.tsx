// Shown while a tab loads: calm placeholder blocks in the shape of the screen.
export default function Loading() {
  return (
    <div className="scroll" aria-busy="true" aria-label="Loading">
      <span className="skeleton" style={{ height: 20, width: "45%" }} />
      <span className="skeleton" style={{ height: 36, width: "80%" }} />
      <span className="skeleton" style={{ height: 72 }} />
      <span className="skeleton" style={{ height: 240 }} />
      <span className="skeleton" style={{ height: 96 }} />
    </div>
  );
}
