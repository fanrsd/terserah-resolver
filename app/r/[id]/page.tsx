import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Decree } from "@/components/decree";
import { RespondPanel } from "@/components/respond-panel";
import { ShareRow } from "@/components/share-row";
import { WaitPanel } from "@/components/wait-panel";
import { isRoomId, store } from "@/lib/room";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const room = isRoomId(id) ? await store().get(id) : null;
  if (!room) return { title: "Perkara sudah ditutup — Terserah" };

  const decided = room.state === "decided" && room.verdict;
  const title = decided
    ? `Putusan: ${room.verdict!.place}`
    : "Kamu bilang terserah. Hak suaramu sudah dipakai.";
  const description = decided
    ? room.verdict!.reasoning
    : `Putusan yang berlaku sekarang: ${room.aChoice}. Buka kalau kamu keberatan.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `/api/og/${id}`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  const room = isRoomId(id) ? await store().get(id) : null;

  if (!room) return <Closed />;

  const isPlaintiff = (await cookies()).has(`ta_${id}`);

  return (
    <main className="mx-auto flex min-h-dvh w-[min(100%-2rem,34rem)] flex-col justify-center py-14">
      {room.state === "decided" && room.verdict ? (
        <>
          <Decree
            caseNo={`Perkara No. ${id.toUpperCase()}`}
            date={room.createdAt}
            place={room.verdict.place}
            reasoning={room.verdict.reasoning}
            mapsQuery={room.verdict.mapsQuery}
            surrendered={!room.bDealbreakers?.length}
          />
          <ShareRow
            id={id}
            stage="verdict"
            text={`Putusan pengadilan: ${room.verdict.place}. ${room.verdict.reasoning}`}
          />
          <Link
            href="/"
            className="chrome mt-8 self-start text-muted transition-colors duration-150 hover:text-bone"
          >
            Ajukan perkara baru
          </Link>
        </>
      ) : isPlaintiff ? (
        <>
          <p className="chrome">Perkara No. {id.toUpperCase()}</p>
          <h1 className="display mt-4 text-[clamp(2rem,10vw,3.25rem)] text-bone">
            Putusan sudah terbit.
          </h1>
          <p className="mt-4 text-lg font-normal text-bone">
            <span className="text-stamp-lift">{room.aChoice}</span> berlaku
            sekarang. Kirim surat panggilannya — kalau dia diam, urusan selesai.
          </p>
          <WaitPanel
            id={id}
            choice={room.aChoice}
            deliberating={room.state !== "awaiting_b"}
          />
        </>
      ) : (
        <>
          <p className="chrome">Surat panggilan · Perkara No. {id.toUpperCase()}</p>
          <h1 className="display mt-4 text-[clamp(1.75rem,8.5vw,2.75rem)] text-bone">
            Kamu bilang terserah.
          </h1>
          <p className="mt-4 font-normal text-muted">
            Jadi hak suaramu sudah dipakai. Putusan yang berlaku:
          </p>
          <p className="display mt-4 break-words text-[clamp(2.25rem,12vw,4.25rem)] text-stamp">
            {room.aChoice}
          </p>
          <p className="mt-5 max-w-[52ch] font-normal text-bone">
            Ini berlaku kalau kamu tidak melakukan apa-apa. Tidak ada hitung
            mundur — cuma tidak ada yang berubah.
          </p>
          <RespondPanel id={id} />
        </>
      )}
    </main>
  );
}

function Closed() {
  return (
    <main className="mx-auto flex min-h-dvh w-[min(100%-2rem,34rem)] flex-col justify-center py-14">
      <p className="chrome">Kepaniteraan</p>
      <h1 className="display mt-4 text-[clamp(2rem,10vw,3.25rem)] text-bone">
        Sidang sudah ditutup.
      </h1>
      <p className="mt-4 max-w-[52ch] font-normal text-muted">
        Berkas perkara ini dimusnahkan 24 jam setelah dibuka. Kalau kalian masih
        belum makan juga, ajukan perkara baru.
      </p>
      <Link
        href="/"
        className="display mt-8 self-start bg-stamp px-6 py-4 text-2xl text-decree transition-[transform,background-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-stamp-lift active:scale-[0.985]"
      >
        Ajukan perkara baru
      </Link>
    </main>
  );
}
