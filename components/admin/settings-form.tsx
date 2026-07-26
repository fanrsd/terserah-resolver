"use client";

import { useState } from "react";
import {
  DEFAULT_PERSONA,
  ENDPOINT_PRESETS,
  LIMITS,
  type Settings,
} from "@/lib/settings-schema";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

type Probe =
  | { state: "idle" | "running" }
  | { state: "ok"; ms: number; place: string; reasoning: string }
  | { state: "fail"; reason: string };

export function SettingsForm({
  initial,
  disabled,
  keyStored,
  canStoreSecrets,
  placeIndex,
}: {
  initial: Settings;
  disabled: boolean;
  keyStored: boolean;
  canStoreSecrets: boolean;
  placeIndex: number;
}) {
  const [form, setForm] = useState(initial);
  // undefined = leave the stored key alone, "" via Hapus = clear it.
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [errorText, setErrorText] = useState("");
  const [probe, setProbe] = useState<Probe>({ state: "idle" });

  const custom = form.provider === "openai";

  const patch = (next: Partial<Settings>) => {
    setForm((previous) => ({ ...previous, ...next }));
    setStatus("idle");
    setProbe({ state: "idle" });
  };

  const payload = () => ({ ...form, apiKey });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || status === "saving") return;

    setStatus("saving");
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    }).catch(() => null);

    if (response?.ok) {
      setStatus("saved");
      setApiKey(undefined);
      return;
    }
    const reason = await response?.json().catch(() => null);
    setErrorText(
      reason?.error === "no_encryption_key"
        ? "SETTINGS_ENCRYPTION_KEY belum diset, jadi API key tidak akan disimpan dalam bentuk terenkripsi."
        : reason?.error === "invalid"
          ? "Isian tidak valid. Cek base URL dan model."
          : "Gagal menyimpan. Cek koneksi Supabase.",
    );
    setStatus("error");
  }

  async function test() {
    setProbe({ state: "running" });
    const response = await fetch("/api/admin/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    }).catch(() => null);

    const result = await response?.json().catch(() => null);
    if (result?.ok) {
      setProbe({
        state: "ok",
        ms: result.ms,
        place: result.place,
        reasoning: result.reasoning,
      });
    } else {
      setProbe({ state: "fail", reason: result?.reason ?? "tidak bisa dihubungi" });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 grid gap-8">
      <fieldset disabled={disabled} className="grid gap-8">
        <div>
          <p className="chrome">Penyedia</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Choice
              checked={!custom}
              onSelect={() => patch({ provider: "gemini" })}
              label="Gemini langsung"
              hint="API native, key dari env"
            />
            <Choice
              checked={custom}
              onSelect={() =>
                patch({
                  provider: "openai",
                  baseUrl: form.baseUrl || ENDPOINT_PRESETS[1].baseUrl,
                  model: form.baseUrl ? form.model : ENDPOINT_PRESETS[1].model,
                })
              }
              label="Endpoint sendiri"
              hint="Apa pun yang OpenAI-compatible"
            />
          </div>
        </div>

        {custom ? (
          <div className="grid gap-6 border-l-0 border-t border-ink-line pt-6">
            <div>
              <label htmlFor="baseUrl" className="chrome block">
                Base URL
              </label>
              <input
                id="baseUrl"
                value={form.baseUrl}
                maxLength={LIMITS.baseUrlMax}
                placeholder="https://openrouter.ai/api/v1"
                spellCheck={false}
                autoComplete="off"
                aria-describedby="baseUrl-hint"
                onChange={(event) => patch({ baseUrl: event.target.value })}
                className="mt-2 w-full border-b-2 border-ink-edge bg-transparent pb-2 text-lg text-bone focus:border-stamp focus:outline-none"
              />
              <p id="baseUrl-hint" className="mt-2 text-xs font-normal text-muted">
                Boleh berakhir di <code>/v1</code> atau langsung di{" "}
                <code>/v1/chat/completions</code> — dua-duanya diterima.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ENDPOINT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      patch({ baseUrl: preset.baseUrl, model: preset.model })
                    }
                    className="chrome border border-ink-edge px-3 py-2 text-muted transition-colors duration-150 hover:border-stamp hover:text-stamp-lift"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <label htmlFor="apiKey" className="chrome">
                  API key
                </label>
                {keyStored && apiKey !== null ? (
                  <button
                    type="button"
                    onClick={() => setApiKey(null)}
                    className="chrome text-muted transition-colors duration-150 hover:text-stamp-lift"
                  >
                    Hapus key tersimpan
                  </button>
                ) : null}
              </div>
              <input
                id="apiKey"
                type="password"
                value={typeof apiKey === "string" ? apiKey : ""}
                maxLength={LIMITS.apiKeyMax}
                autoComplete="off"
                spellCheck={false}
                disabled={!canStoreSecrets}
                aria-describedby="apiKey-hint"
                placeholder={
                  apiKey === null
                    ? "Akan dihapus saat disimpan"
                    : keyStored
                      ? "Tersimpan — isi untuk mengganti"
                      : "sk-…"
                }
                onChange={(event) => {
                  setApiKey(event.target.value || undefined);
                  setStatus("idle");
                }}
                className="mt-2 w-full border-b-2 border-ink-edge bg-transparent pb-2 text-lg text-bone focus:border-stamp focus:outline-none disabled:text-muted"
              />
              <p id="apiKey-hint" className="mt-2 max-w-[68ch] text-xs font-normal text-muted">
                {canStoreSecrets
                  ? "Disimpan terenkripsi (AES-GCM); kunci utamanya ada di env, bukan di database. Tidak pernah dikirim balik ke browser. Kosongkan untuk memakai LLM_API_KEY dari env."
                  : "SETTINGS_ENCRYPTION_KEY belum diset, jadi field ini dimatikan. Pakai LLM_API_KEY di env, atau set kunci enkripsinya supaya key bisa diatur dari sini."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="model" className="chrome block">
              Model
            </label>
            {custom ? (
              <input
                id="model"
                value={form.model}
                maxLength={LIMITS.modelMax}
                spellCheck={false}
                autoComplete="off"
                placeholder="google/gemini-2.5-flash"
                onChange={(event) => patch({ model: event.target.value })}
                className="mt-2 w-full border-b-2 border-ink-edge bg-transparent pb-2 text-lg text-bone focus:border-stamp focus:outline-none"
              />
            ) : (
              <select
                id="model"
                value={form.model}
                onChange={(event) => patch({ model: event.target.value })}
                className="mt-2 w-full border-b-2 border-ink-edge bg-ink pb-2 text-lg text-bone focus:border-stamp focus:outline-none"
              >
                {[...new Set([...GEMINI_MODELS, form.model])].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
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
            className="mt-2 w-full resize-y border border-ink-edge bg-ink-raised p-4 text-sm font-normal leading-relaxed text-bone focus:border-stamp focus:outline-none"
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
            checked={placeIndex > 0 && form.placeCheck}
            disabled={placeIndex === 0}
            onChange={(placeCheck) => patch({ placeCheck })}
            label="Verifikasi tempat lewat indeks Foursquare"
            hint={
              placeIndex > 0
                ? `${placeIndex.toLocaleString("id-ID")} nama tempat makan se-Indonesia, dicocokkan persis di Postgres. Kalau tempat karangan lolos, hakim disuruh memilih ulang sekali.`
                : "Tabel places kosong, jadi saklar ini mati apa pun isinya: nama tempat dipercaya mentah-mentah dari model. Jalankan supabase/migrations/0003_places.sql, lalu isi dengan scripts/load-places.mjs."
            }
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
          className="display border-2 border-transparent bg-stamp px-6 py-3 text-xl text-decree transition-[transform,background-color,border-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-deep active:scale-[0.985] disabled:cursor-not-allowed disabled:border-ink-edge disabled:bg-transparent disabled:text-muted"
        >
          {status === "saving" ? "Menyimpan…" : "Simpan"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={probe.state === "running"}
          className="chrome border border-ink-edge px-4 py-3 text-bone transition-colors duration-150 hover:border-stamp hover:text-stamp-lift disabled:text-muted"
        >
          {probe.state === "running" ? "Menguji…" : "Uji koneksi"}
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
              ? errorText
              : "\u00a0"}
        </p>
      </div>

      {probe.state === "ok" || probe.state === "fail" ? (
        <div
          role="status"
          className={`border p-4 text-sm font-normal ${
            probe.state === "ok"
              ? "border-seal/60 bg-seal/10 text-bone"
              : "border-stamp/60 bg-stamp/10 text-bone"
          }`}
        >
          {probe.state === "ok" ? (
            <>
              <p className="chrome text-seal">Terhubung · {probe.ms} ms</p>
              <p className="mt-2 text-bone">
                Vonis uji: <span className="text-seal">{probe.place}</span>
              </p>
              <p className="mt-1 max-w-[68ch] text-muted">{probe.reasoning}</p>
            </>
          ) : (
            <>
              <p className="chrome text-stamp-lift">Gagal</p>
              <p className="mt-2 max-w-[68ch] text-muted">{probe.reason}</p>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}

function Choice({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`flex-1 min-w-[14rem] border px-4 py-3 text-left transition-colors duration-150 ${
        checked
          ? "border-stamp bg-stamp/10"
          : "border-ink-edge hover:border-muted"
      }`}
    >
      <span className={`block text-base ${checked ? "text-bone" : "text-muted"}`}>
        {label}
      </span>
      <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span>
    </button>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
  danger,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
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
