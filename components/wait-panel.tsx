"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Deliberation } from "@/components/deliberation";
import { ShareRow } from "@/components/share-row";

const POLL_MS = 2000;

/**
 * A's screen while the case is open. Polling instead of a realtime socket:
 * one screen waits for one event, and this is five lines.
 */
export function WaitPanel({
  id,
  choice,
  deliberating: initial,
}: {
  id: string;
  choice: string;
  deliberating: boolean;
}) {
  const router = useRouter();
  const [deliberating, setDeliberating] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/room/${id}`, { cache: "no-store" });
        const { state } = await response.json();
        if (cancelled) return;
        if (state === "decided" || state === "gone") {
          clearInterval(timer);
          router.refresh();
        } else if (state !== "awaiting_b") {
          setDeliberating(true);
        }
      } catch {
        // transient; the next tick retries
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, router]);

  if (deliberating) {
    return (
      <div className="mt-8">
        <p className="chrome">Keberatan diterima</p>
        <div className="mt-4">
          <Deliberation />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <ShareRow
        id={id}
        stage="summon"
        text={`Aku sudah putuskan: ${choice}. Kalau kamu keberatan, buka ini.`}
      />
      <p
        role="status"
        aria-live="polite"
        className="mt-6 text-sm font-normal text-muted"
      >
        Menunggu pihak lain membuka linknya. Layar ini berganti sendiri.
      </p>
    </div>
  );
}
