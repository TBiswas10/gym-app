// Appears the instant you tap, while the guide's own data arrives.
export default function Loading() {
  return (
    <div className="screen fill" aria-busy="true" aria-label="Loading">
      <div className="scroll">
        <span className="skeleton" style={{ height: 20, width: "30%" }} />
        <span className="skeleton media" />
        <span className="skeleton" style={{ height: 32, width: "70%" }} />
        <span className="skeleton" style={{ height: 96 }} />
      </div>
    </div>
  );
}
