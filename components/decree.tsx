import { Stamp } from "@/components/stamp";
import { mapsUrl } from "@/lib/room";
import { SITE_DOMAIN } from "@/lib/site";

const DATE = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * The artifact. One viewport, no scroll, so a screenshot captures it whole.
 * Presentational: the landing renders a specimen of it with no Maps link.
 */
export function Decree({
  caseNo,
  date,
  place,
  reasoning,
  mapsQuery,
  surrendered = false,
  titleAs: Title = "h1",
}: {
  caseNo: string;
  date: number;
  place: string;
  reasoning: string;
  /** Omitted on the landing specimen, where there is nothing to open. */
  mapsQuery?: string;
  surrendered?: boolean;
  /** The place is the page title on a real verdict, but not on the specimen. */
  titleAs?: "h1" | "p";
}) {
  return (
    <article className="sheet animate-decree relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      {/* Letterhead. A shared verdict is the whole distribution channel, so
          the mark has to be on the artifact, not just on the page around it. */}
      <header className="border-b border-decree-ink/25 pb-3">
        <p className="display text-[1.375rem] text-stamp-deep">Terserah</p>
        <div className="mt-1.5 flex items-baseline justify-between gap-4">
          <p className="chrome text-decree-muted">{caseNo}</p>
          <p className="chrome text-decree-muted">{DATE.format(date)}</p>
        </div>
      </header>

      <p className="chrome mt-6 text-stamp-deep">Diputuskan</p>

      <Title className="display mt-2 break-words text-[clamp(1.75rem,9.5vw,3.5rem)] text-decree-ink">
        {place}
      </Title>

      <div className="mt-5 border-t border-decree-ink/25 pt-4">
        <p className="chrome text-decree-muted">Catatan hakim</p>
        <p className="mt-2 max-w-[52ch] text-[0.9375rem] font-normal leading-relaxed text-decree-ink">
          {reasoning}
        </p>
      </div>

      {/* In flow, not absolutely positioned: the stamp used to be anchored to
          the card and landed on the domain line below 360px. Lifted just enough
          to kiss the reasoning's last line — enough to read as struck onto the
          sheet, not enough to swallow a word of the roast. */}
      <Stamp
        label={surrendered ? "Tanpa lawan" : "Final"}
        sub={
          surrendered
            ? "Hak suara tidak digunakan"
            : "Tidak dapat diganggu gugat"
        }
        tone={surrendered ? "seal" : "stamp"}
        className="animate-stamp pointer-events-none -mt-3 ml-auto mr-2 block w-[56%] max-w-[14.5rem] mix-blend-multiply sm:mr-4"
      />

      {mapsQuery ? (
        <a
          href={mapsUrl(mapsQuery)}
          target="_blank"
          rel="noreferrer noopener"
          className="display mt-4 inline-block bg-decree-ink px-5 py-3 text-lg text-decree transition-transform duration-150 ease-[var(--ease-out-quart)] active:scale-[0.98]"
        >
          Buka di Maps
        </a>
      ) : null}

      <p className={`chrome text-decree-muted ${mapsQuery ? "mt-8" : "mt-10"}`}>
        {SITE_DOMAIN}
      </p>
    </article>
  );
}
