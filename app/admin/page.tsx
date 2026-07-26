import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell, SetupNotice } from "@/components/admin/shell";
import { getStats, listCases, PAGE_SIZE, type CaseRow } from "@/lib/history";
import { hasSupabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Riwayat — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "decided", label: "Diputus" },
  { key: "awaiting", label: "Menggantung" },
  { key: "fallback", label: "Hakim gagal" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

const TIME = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminRiwayat({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(0, Number(params.page) || 0);
  const filter: Filter = FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as Filter)
    : "all";

  const [stats, { rows, total }] = await Promise.all([
    getStats(),
    listCases(page, filter),
  ]);

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <AdminShell title="Riwayat perkara" active="riwayat">
      {!hasSupabase() ? (
        <SetupNotice what="SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset, jadi tidak ada riwayat yang tercatat." />
      ) : null}

      {stats ? (
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-ink-line py-5 sm:grid-cols-5">
          <Stat label="Perkara" value={String(stats.total)} />
          <Stat
            label="Menggantung"
            value={`${Math.round(stats.abandonRate * 100)}%`}
            note={`${stats.awaiting} perkara`}
            alarming={stats.abandonRate > 0.4}
          />
          <Stat
            label="Diprotes"
            value={`${Math.round(stats.protestRate * 100)}%`}
            note={`${stats.surrendered} menyerah`}
          />
          <Stat
            label="Hakim gagal"
            value={String(stats.fallback)}
            alarming={stats.fallback > 0}
          />
          <Stat
            label="Median vonis"
            value={
              stats.medianJudgeMs === null ? "—" : `${stats.medianJudgeMs} ms`
            }
          />
        </dl>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Saring riwayat">
        {FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            href={key === "all" ? "/admin" : `/admin?filter=${key}`}
            aria-current={filter === key ? "true" : undefined}
            className={`chrome border px-3 py-2 transition-colors duration-150 ${
              filter === key
                ? "border-stamp text-stamp-lift"
                : "border-ink-line text-muted hover:text-bone"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm font-normal text-muted">
          {hasSupabase()
            ? "Belum ada perkara yang cocok dengan saringan ini."
            : "Riwayat tidak aktif."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm font-normal">
            <thead>
              <tr className="border-b border-ink-line">
                <Th>Waktu</Th>
                <Th>Perkara</Th>
                <Th>Kota</Th>
                <Th>Putusan A</Th>
                <Th>Hasil</Th>
                <Th>Vonis</Th>
                <Th>Lama</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 0 ? (
        <nav
          className="mt-8 flex items-center justify-between"
          aria-label="Halaman"
        >
          <PageLink
            filter={filter}
            page={page - 1}
            disabled={page === 0}
            label="← Sebelumnya"
          />
          <p className="chrome">
            Hal. {page + 1} / {lastPage + 1}
          </p>
          <PageLink
            filter={filter}
            page={page + 1}
            disabled={page >= lastPage}
            label="Berikutnya →"
          />
        </nav>
      ) : null}
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  note,
  alarming,
}: {
  label: string;
  value: string;
  note?: string;
  alarming?: boolean;
}) {
  return (
    <div>
      <dt className="chrome">{label}</dt>
      <dd
        className={`mt-1 text-2xl ${alarming ? "text-stamp-lift" : "text-bone"}`}
      >
        {value}
      </dd>
      {note ? (
        <p className="mt-0.5 text-xs font-normal text-muted">{note}</p>
      ) : null}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="chrome py-2 pr-4 align-bottom">
      {children}
    </th>
  );
}

function Row({ row }: { row: CaseRow }) {
  const decided = row.state === "decided";
  const protested = Boolean(row.b_dealbreakers?.length);

  return (
    <tr className="border-b border-ink-line/60 align-top">
      <td className="py-3 pr-4 whitespace-nowrap text-muted">
        {TIME.format(new Date(row.created_at))}
      </td>
      <td className="py-3 pr-4 whitespace-nowrap text-muted">
        {row.id.toUpperCase()}
      </td>
      <td className="py-3 pr-4 text-bone">{row.city}</td>
      <td className="py-3 pr-4 text-muted">{row.a_choice}</td>
      <td className="py-3 pr-4 whitespace-nowrap">
        {!decided ? (
          <span className="text-muted">Menggantung</span>
        ) : protested ? (
          <span className="text-bone">Protes</span>
        ) : (
          <span className="text-seal">Menyerah</span>
        )}
      </td>
      <td className="py-3 pr-4">
        {row.verdict_place ? (
          <>
            <span className={row.fallback ? "text-stamp-lift" : "text-bone"}>
              {row.verdict_place}
            </span>
            {row.fallback ? (
              <span className="chrome ml-2 text-stamp-lift">gagal</span>
            ) : row.place_verified === false ? (
              <span className="chrome ml-2 text-muted">tak terverifikasi</span>
            ) : null}
            {row.verdict_reason ? (
              <p className="mt-1 max-w-[38ch] text-xs text-muted">
                {row.verdict_reason}
              </p>
            ) : null}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="py-3 whitespace-nowrap text-muted">
        {row.judge_ms ? `${row.judge_ms} ms` : "—"}
      </td>
    </tr>
  );
}

function PageLink({
  filter,
  page,
  disabled,
  label,
}: {
  filter: Filter;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return <span className="chrome text-ink-line">{label}</span>;
  }
  const query = new URLSearchParams();
  if (filter !== "all") query.set("filter", filter);
  if (page > 0) query.set("page", String(page));
  const search = query.toString();

  return (
    <Link
      href={search ? `/admin?${search}` : "/admin"}
      className="chrome text-muted transition-colors duration-150 hover:text-stamp-lift"
    >
      {label}
    </Link>
  );
}
