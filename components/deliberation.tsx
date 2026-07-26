"use client";

import { useEffect, useState } from "react";

const LINES = ["Menimbang…", "Mengadili…", "Memutuskan…"];
const STEP_MS = 750;

/**
 * The drama beat while the judge runs. Not a spinner: a reading of the record.
 *
 * A reasoning model behind a custom endpoint can legitimately think for 30-60s,
 * so once the three lines are out this keeps counting rather than sitting on a
 * frozen screen — the difference between "deliberating" and "broken".
 */
export function Deliberation() {
  const [shown, setShown] = useState(1);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) setShown(LINES.length);

    const startedAt = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
      if (!reduced) setShown((n) => Math.min(n + 1, LINES.length));
    }, reduced ? 1000 : STEP_MS);

    return () => clearInterval(timer);
  }, []);

  const done = shown >= LINES.length;

  return (
    <div role="status" aria-live="polite" className="grid gap-2">
      <span className="sr-only">Hakim sedang menimbang perkara.</span>
      {LINES.slice(0, shown).map((line, index) => (
        <p
          key={line}
          aria-hidden
          className={`display animate-line text-2xl ${
            index === shown - 1 && !done ? "caret text-bone" : "text-muted"
          }`}
        >
          {line}
        </p>
      ))}

      {done && seconds >= 8 ? (
        <p aria-hidden className="mt-2 text-sm font-normal text-muted">
          {seconds >= 25
            ? `Hakim masih menimbang — ${seconds} detik. Model yang berpikir panjang memang lama.`
            : `Masih menimbang… ${seconds} detik.`}
        </p>
      ) : null}
    </div>
  );
}
