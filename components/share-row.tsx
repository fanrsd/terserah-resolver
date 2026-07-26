"use client";

import { useState } from "react";

/**
 * `summon` is A's only job on the waiting screen, so it gets the primary
 * button and no image link — there is no verdict worth saving yet.
 */
export function ShareRow({
  id,
  text,
  stage,
}: {
  id: string;
  text: string;
  stage: "summon" | "verdict";
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/r/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pengadilan Terserah", text, url });
        return;
      } catch {
        // user dismissed the sheet; fall through to copying
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  if (stage === "summon") {
    return (
      <button
        type="button"
        onClick={share}
        className="display w-full bg-stamp px-6 py-5 text-2xl text-decree transition-[transform,background-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-lift active:scale-[0.985] sm:text-3xl"
      >
        {copied ? "Link tersalin" : "Kirim surat panggilan"}
      </button>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={share}
        className="chrome border border-ink-line px-4 py-3 text-bone transition-colors duration-150 ease-[var(--ease-out-quart)] hover:border-stamp hover:text-stamp-lift"
      >
        {copied ? "Link tersalin" : "Bagikan putusan"}
      </button>
      <a
        href={`/api/og/${id}`}
        download={`putusan-${id}.png`}
        className="chrome border border-ink-line px-4 py-3 text-bone transition-colors duration-150 ease-[var(--ease-out-quart)] hover:border-stamp hover:text-stamp-lift"
      >
        Simpan gambar
      </a>
    </div>
  );
}
