"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Deliberation } from "@/components/deliberation";
import { DEALBREAKER_COUNT, MAX_DEALBREAKER_LENGTH } from "@/lib/room";

const PLACEHOLDERS = ["Gak mau panas", "Gak mau rame", "Gak mau yang digoreng"];
const MIN_BEAT_MS = 2400;

export function RespondPanel({ id }: { id: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "protesting" | "sending">("idle");
  const [reasons, setReasons] = useState(["", "", ""]);
  const [error, setError] = useState("");

  const complete = reasons.every((reason) => reason.trim().length > 1);

  async function send(body: Record<string, unknown>) {
    setStage("sending");
    setError("");
    const startedAt = Date.now();
    try {
      const response = await fetch(`/api/room/${id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok && response.status !== 409) {
        throw new Error(String(response.status));
      }
    } catch {
      setError("Panitera tidak merespons. Coba lagi.");
      setStage(body.action === "protest" ? "protesting" : "idle");
      return;
    }
    // Hold the beat even when the model answers fast; the reading is the drama.
    const remaining = MIN_BEAT_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      const beat = Promise.withResolvers<void>();
      setTimeout(beat.resolve, remaining);
      await beat.promise;
    }
    router.refresh();
  }

  if (stage === "sending") {
    return (
      <div className="mt-8">
        <Deliberation />
      </div>
    );
  }

  if (stage === "protesting") {
    return (
      <form
        className="mt-8"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (complete) void send({ action: "protest", dealbreakers: reasons });
        }}
      >
        <h2 className="display text-2xl text-bone">
          Sebutkan tiga hal yang tidak kamu mau.
        </h2>
        <p className="mt-2 text-sm font-normal text-muted">
          Bukan apa yang kamu mau — itu bagian yang tidak pernah kamu jawab.
        </p>

        <ol className="mt-6 grid gap-4">
          {reasons.map((reason, index) => (
            <li
              key={index}
              className="grid grid-cols-[1.75rem_1fr] items-center"
            >
              <label
                htmlFor={`reason-${index}`}
                className="display text-base text-stamp-lift"
              >
                {index + 1}
                <span className="sr-only">
                  {" "}
                  Keberatan ke-{index + 1} dari {DEALBREAKER_COUNT}
                </span>
              </label>
              <input
                id={`reason-${index}`}
                value={reason}
                maxLength={MAX_DEALBREAKER_LENGTH}
                placeholder={PLACEHOLDERS[index]}
                autoComplete="off"
                autoFocus={index === 0}
                onChange={(event) =>
                  setReasons((previous) =>
                    previous.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  )
                }
                className="w-full border-b-2 border-ink-line bg-transparent pb-2 text-lg text-bone transition-colors duration-150 ease-[var(--ease-out-quart)] focus:border-stamp focus:outline-none"
              />
            </li>
          ))}
        </ol>

        <button
          type="submit"
          disabled={!complete}
          className="display mt-8 w-full bg-stamp px-6 py-4 text-2xl text-decree transition-[transform,background-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-lift active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-ink-raised disabled:text-muted"
        >
          Ajukan keberatan
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-stamp-lift">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setStage("protesting")}
        className="display w-full bg-stamp px-6 py-5 text-3xl text-decree transition-[transform,background-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-lift active:scale-[0.985] sm:text-4xl"
      >
        Gak mau ah
      </button>
      <button
        type="button"
        onClick={() => void send({ action: "accept" })}
        className="chrome mt-4 w-full py-3 text-muted transition-colors duration-150 ease-[var(--ease-out-quart)] hover:text-bone"
      >
        Ya udah, terserah
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-stamp-lift">
          {error}
        </p>
      ) : null}
    </div>
  );
}
