import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { isRoomId, store } from "@/lib/room";

// Satori has no CSS variables; these mirror app/globals.css exactly.
const INK = "#150d0c";
const INK_LINE = "#3d2f2e";
const STAMP = "#db2c2b";
const STAMP_DEEP = "#b00c15";
const DECREE = "#f0e9e7";
const DECREE_INK = "#1a1513";
const BONE = "#e8e3e1";
const MUTED = "#a09694";
const SEAL = "#5b5c15"; // --color-seal-deep

const font = (name: string) =>
  readFile(join(process.cwd(), "assets", name)).then(
    (b) => new Uint8Array(b).buffer as ArrayBuffer,
  );

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const room = isRoomId(id) ? await store.get(id) : null;

  const [anton, courier, courierBold] = await Promise.all([
    font("Anton-Regular.ttf"),
    font("CourierPrime-Regular.ttf"),
    font("CourierPrime-Bold.ttf"),
  ]);

  const fonts = [
    { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
    { name: "Courier", data: courier, weight: 400 as const, style: "normal" as const },
    { name: "Courier", data: courierBold, weight: 700 as const, style: "normal" as const },
  ];

  const size = { width: 1200, height: 630 };
  const label = {
    fontFamily: "Courier",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 3.4,
    textTransform: "uppercase" as const,
  };

  if (!room) {
    return new ImageResponse(
      (
        <div
          style={{
            ...size,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: INK,
            padding: 80,
          }}
        >
          <div style={{ ...label, color: MUTED, display: "flex" }}>
            Kepaniteraan
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: 104,
              color: BONE,
              marginTop: 20,
              textTransform: "uppercase",
            }}
          >
            Sidang sudah ditutup
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  }

  const verdict = room.state === "decided" ? room.verdict : undefined;

  if (!verdict) {
    return new ImageResponse(
      (
        <div
          style={{
            ...size,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: INK,
            padding: 80,
            borderTop: `14px solid ${STAMP}`,
          }}
        >
          <div style={{ ...label, color: MUTED, display: "flex" }}>
            Surat panggilan · Perkara No. {id.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: 78,
              lineHeight: 1,
              color: BONE,
              marginTop: 26,
              textTransform: "uppercase",
            }}
          >
            Kamu bilang terserah.
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: 104,
              lineHeight: 1,
              color: STAMP,
              marginTop: 14,
              textTransform: "uppercase",
            }}
          >
            {room.aChoice}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Courier",
              fontSize: 26,
              color: MUTED,
              marginTop: 30,
            }}
          >
            Putusan ini berlaku kalau kamu diam saja.
          </div>
        </div>
      ),
      { ...size, fonts, headers: { "cache-control": "public, max-age=60" } },
    );
  }

  const surrendered = !room.bDealbreakers?.length;
  const placeSize =
    verdict.place.length > 26 ? 62 : verdict.place.length > 16 ? 80 : 104;

  return new ImageResponse(
    (
      <div
        style={{
          ...size,
          display: "flex",
          background: INK,
          padding: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            position: "relative",
            background: DECREE,
            padding: "44px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: `2px solid ${INK_LINE}33`,
              paddingBottom: 18,
            }}
          >
            <div style={{ ...label, color: `${DECREE_INK}b3`, display: "flex" }}>
              Perkara No. {id.toUpperCase()}
            </div>
            <div style={{ ...label, color: `${DECREE_INK}b3`, display: "flex" }}>
              terserah.app
            </div>
          </div>

          <div
            style={{ ...label, color: STAMP_DEEP, display: "flex", marginTop: 34 }}
          >
            Diputuskan
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Anton",
              fontSize: placeSize,
              lineHeight: 1,
              color: DECREE_INK,
              marginTop: 10,
              textTransform: "uppercase",
            }}
          >
            {verdict.place}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Courier",
              fontSize: 26,
              lineHeight: 1.5,
              color: DECREE_INK,
              marginTop: 28,
              maxWidth: 720,
            }}
          >
            {verdict.reasoning}
          </div>

          <div
            style={{
              position: "absolute",
              right: 40,
              bottom: 34,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 300,
              height: 108,
              border: `7px solid ${surrendered ? SEAL : STAMP_DEEP}`,
              transform: "rotate(-8deg)",
              opacity: 0.9,
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Anton",
                fontSize: 40,
                color: surrendered ? SEAL : STAMP_DEEP,
                textTransform: "uppercase",
              }}
            >
              {surrendered ? "Tanpa lawan" : "Final"}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Courier",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1.8,
                marginTop: 5,
                color: surrendered ? SEAL : STAMP_DEEP,
                textTransform: "uppercase",
              }}
            >
              {surrendered ? "Hak suara tak dipakai" : "Tak dapat diganggu gugat"}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    },
  );
}
