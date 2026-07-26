"use client";

import { useEffect, useState } from "react";

const LINES = ["Menimbang…", "Mengadili…", "Memutuskan…"];
const STEP_MS = 750;

/** The drama beat while the judge runs. Not a spinner: a reading of the record. */
export function Deliberation() {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(LINES.length);
      return;
    }
    const timer = setInterval(
      () => setShown((n) => Math.min(n + 1, LINES.length)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="grid gap-2">
      <span className="sr-only">Hakim sedang menimbang perkara.</span>
      {LINES.slice(0, shown).map((line, index) => (
        <p
          key={line}
          aria-hidden
          className={`display animate-line text-2xl ${
            index === shown - 1 && shown < LINES.length
              ? "caret text-bone"
              : "text-muted"
          }`}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
