"use client";

export function RetryButton({ label = "Try again" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-primary btn-cta" onClick={() => window.location.reload()}>
      {label}
    </button>
  );
}
