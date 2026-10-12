"use client";

/** A 1-5 scale as five big buttons with the word under each number (no slider to drag by accident). */
export function ScalePick({
  label,
  hint,
  words,
  value,
  onChange,
  warn = false,
}: {
  label: string;
  hint: string;
  words: readonly string[];
  value: number | null;
  onChange: (v: number) => void;
  warn?: boolean;
}) {
  return (
    <fieldset className="scale5-set">
      <legend className="t-body" style={{ fontWeight: 700 }}>{label}</legend>
      <p className="t-small c-2">{hint}</p>
      <div className={`scale5 ${warn ? "scale5-warn" : ""}`} role="radiogroup" aria-label={label}>
        {words.map((w, i) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            className={`scale5-btn ${value === i + 1 ? "is-on" : ""}`}
            onClick={() => onChange(i + 1)}
          >
            <span className="scale5-n">{i + 1}</span>
            <span className="scale5-w">{w}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
