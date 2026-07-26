"use client";

import { useState } from "react";
import { DEFAULT_PERSONA, LIMITS, type Settings } from "@/lib/settings-schema";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

export function SettingsForm({
  initial,
  disabled,
}: {
  initial: Settings;
  disabled: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const patch = (next: Partial<Settings>) => {
    setForm((previous) => ({ ...previous, ...next }));
    setStatus("idle");
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || status === "saving") return;

    setStatus("saving");
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setStatus(response?.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-8">
      <fieldset disabled={disabled} className="grid gap-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="model" className="chrome block">
              Model
            </label>
            <select
              id="model"
              value={form.model}
              onChange={(event) => patch({ model: event.target.value })}
              className="mt-2 w-full border-b-2 border-ink-line bg-ink pb-2 text-lg text-bone focus:border-stamp focus:outline-none"
            >
              {MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              {MODELS.includes(form.model as (typeof MODELS)[number]) ? null : (
                <option value={form.model}>{form.model}</option>
              )}
            </select>
            <p className="mt-2 text-xs font-normal text-muted">
              Flash cukup dan murah. Pro lebih tajam sarkasmenya tapi lebih
              lambat, dan layar ini sudah punya jeda 2,4 detik.
            </p>
          </div>

          <div>
            <label htmlFor="temperature" className="chrome block">
              Temperature — {form.temperature.toFixed(2)}
            </label>
            <input
              id="temperature"
              type="range"
              min={LIMITS.temperatureMin}
              max={LIMITS.temperatureMax}
              step={0.05}
              value={form.temperature}
              onChange={(event) =>
                patch({ temperature: Number(event.target.value) })
              }
              className="mt-4 w-full accent-[var(--color-stamp)]"
            />
            <p className="mt-2 text-xs font-normal text-muted">
              Di bawah 0,7 vonisnya jadi datar dan berulang. Di atas 1,4 hakim
              mulai mengarang nama tempat.
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <label htmlFor="persona" className="chrome">
              Persona hakim (system prompt)
            </label>
            <button
              type="button"
              onClick={() => patch({ persona: DEFAULT_PERSONA })}
              className="chrome text-muted transition-colors duration-150 hover:text-stamp-lift"
            >
              Kembalikan bawaan
            </button>
          </div>
          <textarea
            id="persona"
            rows={16}
            value={form.persona}
            maxLength={LIMITS.personaMax}
            spellCheck={false}
            onChange={(event) => patch({ persona: event.target.value })}
            className="mt-2 w-full resize-y border border-ink-line bg-ink-raised p-4 text-sm font-normal leading-relaxed text-bone focus:border-stamp focus:outline-none"
          />
          <p className="mt-2 max-w-[68ch] text-xs font-normal text-muted">
            Aturan &ldquo;sindir kedua belah pihak&rdquo; adalah satu-satunya
            baris yang menahan produk ini jadi senjata Pihak A. Kalau dihapus,
            Pihak B berhenti membagikan hasilnya dan loop-nya mati.{" "}
            {form.persona.length}/{LIMITS.personaMax}
          </p>
        </div>

        <div className="grid gap-4">
          <Toggle
            id="placeCheck"
            checked={form.placeCheck}
            onChange={(placeCheck) => patch({ placeCheck })}
            label="Verifikasi tempat lewat Places"
            hint="Text Search dengan field mask places.id saja: gratis tanpa batas. Kalau tempat karangan lolos, hakim disuruh memilih ulang sekali."
          />
          <Toggle
            id="paused"
            checked={form.paused}
            onChange={(paused) => patch({ paused })}
            label="Hentikan perkara baru"
            hint="Saklar darurat. Perkara yang sudah jalan tetap bisa diputus; yang baru ditolak."
            danger
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={disabled || status === "saving"}
          className="display bg-stamp px-6 py-3 text-xl text-decree transition-[transform,background-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-lift active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-ink-raised disabled:text-muted"
        >
          {status === "saving" ? "Menyimpan…" : "Simpan"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`text-sm font-normal ${
            status === "error" ? "text-stamp-lift" : "text-muted"
          }`}
        >
          {status === "saved"
            ? "Tersimpan. Berlaku dalam 30 detik."
            : status === "error"
              ? "Gagal menyimpan. Cek koneksi Supabase."
              : "\u00a0"}
        </p>
      </div>
    </form>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
  danger,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 accent-[var(--color-stamp)]"
      />
      <label
        htmlFor={id}
        className={`text-base ${danger && checked ? "text-stamp-lift" : "text-bone"}`}
      >
        {label}
      </label>
      <p
        id={`${id}-hint`}
        className="col-start-2 max-w-[68ch] text-xs font-normal text-muted"
      >
        {hint}
      </p>
    </div>
  );
}
