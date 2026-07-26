import { CreateForm } from "@/components/create-form";
import { Decree } from "@/components/decree";

const PROCEDURE = [
  "Kamu tetapkan satu tempat. Perkara terbuka.",
  "Kirim linknya. Begitu dia buka, putusan itu sudah berlaku.",
  "Diam berarti setuju. Protes berarti dia harus menyebut tiga hal yang tidak dia mau — dan hakim menutup perkara.",
];

const SPECIMEN = {
  place: "SATE TAICHAN SENAYAN",
  reasoning:
    "Pihak A sengaja menawarkan warkop supaya dipaksa berdebat, dan Pihak B baru punya tiga syarat setelah diancam. Kalian berdua tidak sesantai itu.",
  date: Date.UTC(2026, 6, 19),
};

export default function Home() {
  return (
    <main className="mx-auto w-[min(100%-2rem,34rem)] py-16">
      <p className="chrome">Pengadilan Terserah · Sidang terbuka</p>

      <h1 className="display mt-5 text-[clamp(2.75rem,13vw,5rem)] text-bone">
        Dia bilang
        <br />
        <span className="text-stamp">terserah.</span>
      </h1>

      <p className="mt-6 max-w-[60ch] text-lg font-normal leading-relaxed text-bone">
        Lalu menolak semua saranmu. Cukup. Tetapkan satu tempat sekarang —
        putusannya berlaku begitu dia buka linknya, sampai dia berani protes.
      </p>

      <CreateForm />

      <section aria-labelledby="contoh" className="mt-20">
        <h2 id="contoh" className="chrome">
          Yang keluar di akhir
        </h2>
        <div className="mt-4 rotate-[-1.2deg]">
          <Decree
            caseNo="Contoh perkara"
            date={SPECIMEN.date}
            place={SPECIMEN.place}
            reasoning={SPECIMEN.reasoning}
            titleAs="p"
          />
        </div>
      </section>

      <section aria-labelledby="tata-cara" className="mt-20">
        <h2 id="tata-cara" className="chrome">
          Tata cara
        </h2>
        <ol className="mt-4 grid gap-3 text-sm font-normal text-muted">
          {PROCEDURE.map((step, index) => (
            <li key={step} className="grid grid-cols-[1.75rem_1fr] items-start">
              <span className="display pt-0.5 text-base text-stamp-lift">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-16 border-t border-ink-line pt-5 text-xs font-normal text-muted">
        Putusan dibuat oleh mesin dan tidak mengikat secara hukum. Perkara
        dihapus otomatis setelah 24 jam.
      </footer>
    </main>
  );
}
