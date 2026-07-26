import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { AdminShell, SetupNotice } from "@/components/admin/shell";
import { getSettings } from "@/lib/settings";
import { hasSupabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Pengaturan — Admin",
  robots: "noindex",
};
export const dynamic = "force-dynamic";

export default async function AdminPengaturan() {
  const settings = await getSettings();

  return (
    <AdminShell title="Pengaturan API" active="pengaturan">
      {!hasSupabase ? (
        <SetupNotice what="SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset, jadi perubahan di sini tidak bisa disimpan." />
      ) : null}

      <p className="mt-6 max-w-[68ch] text-sm font-normal text-muted">
        Perubahan berlaku untuk vonis berikutnya, paling lambat 30 detik
        (settings di-cache sebentar supaya jalur panas tidak menembak database
        tiap perkara).
      </p>

      <SettingsForm initial={settings} disabled={!hasSupabase} />

      <section className="mt-14 border-t border-ink-line pt-6">
        <h2 className="chrome">Yang sengaja tidak ada di sini</h2>
        <ul className="mt-3 grid max-w-[68ch] gap-2 text-sm font-normal text-muted">
          <li>
            <span className="text-bone">API key.</span> Kunci Gemini dan Places
            tetap di environment variable. Menyimpan rahasia di database yang
            dibaca aplikasi lebih buruk daripada di env, dan rotasi lewat UI
            bukan kebutuhan nyata untuk satu orang admin.
          </li>
          <li>
            <span className="text-bone">Field mask Places.</span> Dikunci ke{" "}
            <code>places.id</code> selamanya. Field apa pun yang mengembalikan
            nama menaikkan tagihan dari gratis ke $32/1.000.
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
