import Link from "next/link";
import { LogoutButton } from "@/components/admin/logout-button";

/**
 * Product register: this is a tool, not the brand surface. No decree cards,
 * no stamps, no display type beyond the page title.
 */
export function AdminShell({
  title,
  active,
  children,
}: {
  title: string;
  active: "riwayat" | "pengaturan";
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-[min(100%-2rem,64rem)] py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-line pb-4">
        <p className="chrome">Pengadilan Terserah · Panel admin</p>
        <nav className="flex items-center gap-5">
          <Link
            href="/admin"
            aria-current={active === "riwayat" ? "page" : undefined}
            className={`chrome transition-colors duration-150 hover:text-bone ${
              active === "riwayat" ? "text-stamp-lift" : "text-muted"
            }`}
          >
            Riwayat
          </Link>
          <Link
            href="/admin/pengaturan"
            aria-current={active === "pengaturan" ? "page" : undefined}
            className={`chrome transition-colors duration-150 hover:text-bone ${
              active === "pengaturan" ? "text-stamp-lift" : "text-muted"
            }`}
          >
            Pengaturan
          </Link>
          <LogoutButton />
        </nav>
      </header>

      <h1 className="display mt-8 text-[clamp(1.75rem,6vw,2.75rem)] text-bone">
        {title}
      </h1>

      {children}
    </div>
  );
}

export function SetupNotice({ what }: { what: string }) {
  return (
    <p className="mt-6 border border-stamp/50 bg-stamp/10 px-4 py-3 text-sm font-normal text-bone">
      {what} Aplikasi tetap jalan tanpa ini — nilai bawaan yang dipakai.
    </p>
  );
}
