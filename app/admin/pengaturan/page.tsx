import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { AdminShell, SetupNotice } from "@/components/admin/shell";
import { placeIndexSize } from "@/lib/judge";
import { canStoreSecrets } from "@/lib/secret";
import { getSettings, hasStoredKey } from "@/lib/settings";
import { hasSupabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Pengaturan — Admin",
  robots: "noindex",
};
export const dynamic = "force-dynamic";

export default async function AdminPengaturan() {
  const [settings, keyStored, placeIndex] = await Promise.all([
    getSettings(),
    hasStoredKey(),
    placeIndexSize(),
  ]);

  return (
    <AdminShell title="Pengaturan API" active="pengaturan">
      {!hasSupabase() ? (
        <SetupNotice what="SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset, jadi perubahan di sini tidak bisa disimpan." />
      ) : null}

      <p className="mt-6 max-w-[68ch] text-sm font-normal text-muted">
        Perubahan berlaku untuk vonis berikutnya, paling lambat 30 detik
        (settings di-cache sebentar supaya jalur panas tidak menembak database
        tiap perkara). Pakai <span className="text-bone">Uji koneksi</span>{" "}
        sebelum menyimpan — base URL yang salah ketik baru ketahuan saat ada
        pasangan sungguhan yang kena vonis cadangan.
      </p>

      <SettingsForm
        initial={settings}
        disabled={!hasSupabase()}
        keyStored={keyStored}
        canStoreSecrets={canStoreSecrets()}
        placeIndex={placeIndex}
      />

      <section className="mt-14 border-t border-ink-line pt-6">
        <h2 className="chrome">Catatan</h2>
        <ul className="mt-3 grid max-w-[68ch] gap-2 text-sm font-normal text-muted">
          <li>
            <span className="text-bone">Structured output menurun sendiri.</span>{" "}
            Endpoint dicoba dengan <code>json_schema</code> dulu, lalu{" "}
            <code>json_object</code>, lalu teks biasa. Server lokal seperti
            Ollama dan LM Studio biasanya berhenti di tingkat kedua, dan parser
            vonis tetap menangkap JSON di dalam blok kode.
          </li>
          <li>
            <span className="text-bone">Key Gemini tetap di env.</span> Mode
            &ldquo;Gemini langsung&rdquo; membaca <code>GEMINI_API_KEY</code>.
            Hanya endpoint sendiri yang key-nya bisa diatur dari sini, karena di
            situlah gunanya: ganti penyedia tanpa deploy ulang.
          </li>
          <li>
            <span className="text-bone">Indeks tempat itu lokal.</span> Bukan
            panggilan ke Google — 1 juta nama tempat makan se-Indonesia dari
            Foursquare Open Source Places, tersimpan di Postgres yang sama.
            Tidak ada key, tidak ada kuota, tidak ada tagihan.
          </li>
          <li>
            <span className="text-bone">Rate limit.</span> 5 perkara/jam/IP,
            dikunci di kode. Kalau perlu diubah, itu keputusan deploy, bukan
            keputusan dashboard.
          </li>
        </ul>
      </section>
    </AdminShell>
  );
}
