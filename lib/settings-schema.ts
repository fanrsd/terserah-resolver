/**
 * Pure half of the settings module: no Supabase import, so the admin form can
 * use these without pulling the SDK into the client bundle.
 */

export const DEFAULT_PERSONA = `Kamu adalah hakim tunggal di "Pengadilan Terserah". Kamu memutus sengketa
"mau makan di mana" antara dua orang. Nada bicaramu: formal, dingin, sarkastis, seperti
membacakan putusan resmi. Humormu datang dari kontras antara bahasa birokrasi yang kaku
dan isi yang menohok.

ATURAN YANG TIDAK BISA DILANGGAR:
1. Sindir KEDUA belah pihak. Bukan cuma satu. Kalau kamu cuma menyindir Pihak B, putusan
   ini berubah jadi senjata Pihak A dan kamu gagal. Pihak A juga salah: dia sengaja
   memilih tempat yang menyebalkan supaya pasangannya bereaksi.
2. Sebutkan TEPAT SATU tempat makan yang benar-benar ada di kota yang disebutkan.
   Nama spesifik, bukan kategori. Jangan tawarkan alternatif.
3. Alasan maksimal 2 kalimat, di bawah 220 karakter. Bahasa Indonesia santai.
4. Jangan menggurui, jangan minta maaf, jangan menawarkan opsi lain.`;

export type Settings = {
  model: string;
  temperature: number;
  /** The system prompt. The single highest-leverage knob in the product. */
  persona: string;
  /** Free IDs-only Places existence check. Off = trust the model outright. */
  placeCheck: boolean;
  /** Kill switch: stops new cases without a redeploy. */
  paused: boolean;
};

export const LIMITS = {
  personaMax: 6000,
  modelMax: 60,
  temperatureMin: 0,
  temperatureMax: 2,
};

export function normalizeSettings(input: unknown): Settings | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const model = String(raw.model ?? "")
    .trim()
    .slice(0, LIMITS.modelMax);
  const temperature = Number(raw.temperature);
  const persona = String(raw.persona ?? "")
    .trim()
    .slice(0, LIMITS.personaMax);

  if (!model) return null;
  if (
    !Number.isFinite(temperature) ||
    temperature < LIMITS.temperatureMin ||
    temperature > LIMITS.temperatureMax
  ) {
    return null;
  }

  return {
    model,
    temperature,
    // A blank textarea means "use the shipped default", so the judge can never
    // be silently stripped of its instructions.
    persona: persona || DEFAULT_PERSONA,
    placeCheck: Boolean(raw.placeCheck),
    paused: Boolean(raw.paused),
  };
}
