"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_CHOICE_LENGTH, MAX_CITY_LENGTH } from "@/lib/room";

export function CreateForm() {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [city, setCity] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const ready = choice.trim().length > 1 && city.trim().length > 1;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice, city }),
      });
      if (response.status === 429 || response.status === 503) {
        setError(
          response.status === 503
            ? "Pengadilan sedang tutup. Coba lagi nanti."
            : "Kamu sudah membuka terlalu banyak perkara jam ini. Istirahat dulu.",
        );
        setPending(false);
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const { id } = await response.json();
      router.push(`/r/${id}`);
    } catch {
      setError("Panitera tidak merespons. Coba sekali lagi.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-10 grid gap-5">
      <Field
        id="choice"
        label="Putusan kamu"
        hint="Tulis tempat yang kamu mau. Ini langsung berlaku."
        placeholder="Warkop depan gang"
        value={choice}
        max={MAX_CHOICE_LENGTH}
        onChange={setChoice}
        autoFocus
      />
      <Field
        id="city"
        label="Kota"
        hint="Biar hakim tidak mengarang tempat di kota lain."
        placeholder="Jakarta Selatan"
        value={city}
        max={MAX_CITY_LENGTH}
        onChange={setCity}
      />

      <button
        type="submit"
        disabled={!ready || pending}
        className="display mt-1 w-full border-2 border-transparent bg-stamp px-6 py-4 text-2xl text-decree transition-[transform,background-color,border-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-deep active:scale-[0.985] disabled:cursor-not-allowed disabled:border-ink-edge disabled:bg-transparent disabled:text-muted sm:text-3xl"
      >
        {pending ? "Menerbitkan…" : "Terbitkan putusan"}
      </button>

      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${error ? "text-stamp-lift" : "text-muted"}`}
      >
        {error || (ready ? "Link-nya muncul di layar berikutnya." : "\u00a0")}
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  placeholder,
  value,
  max,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="chrome block">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border-b-2 border-ink-edge bg-transparent pb-2 text-xl text-bone transition-colors duration-150 ease-[var(--ease-out-quart)] focus:border-stamp focus:outline-none"
      />
      <p id={`${id}-hint`} className="mt-2 text-sm font-normal text-muted">
        {hint}
      </p>
    </div>
  );
}
