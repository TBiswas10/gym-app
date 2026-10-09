"use client";

import "./globals.css";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/app.css";

// Last resort: used only if the whole app fails to start. Keeps the app's look and never shows technical text.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-AU">
      <body>
        <div className="screen fill">
          <div className="scroll">
            <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
              <h1 className="t-title">That didn’t load</h1>
              <p className="t-body c-2">Something went wrong. Anything you logged is safe. Try again in a moment.</p>
            </div>
          </div>
          <div className="bottom-bar">
            <button type="button" className="btn btn-primary btn-cta" onClick={reset}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
