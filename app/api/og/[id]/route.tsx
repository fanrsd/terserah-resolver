import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-fonts";
import { SITE_DOMAIN } from "@/lib/site";
import { getRoom, isRoomId } from "@/lib/room";

// Satori has no CSS variables; these mirror app/globals.css exactly.
const INK = "#150d0c";
const INK_LINE = "#3d2f2e";
const STAMP = "#db2c2b";
const STAMP_DEEP = "#b00c15";
const DECREE = "#f0e9e7";
const DECREE_INK = "#1a1513";
const DECREE_MUTED = "#6b6462"; // --color-decree-muted, 4.8:1 on the sheet
const BONE = "#e8e3e1";
const MUTED = "#a09694";
const SEAL = "#5b5c15"; // --color-seal-deep



export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const room = isRoomId(id) ? await getRoom(id) : null;

  const fonts = ogFonts();

  const size = { width: 1200, height: 630 };
  const label = {
    fontFamily: "Courier",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: 3.4,
    textTransform: "uppercase" as const,
  };

  // Every shared image carries the mark. On the ink branches it is pinned
  // like a letterhead; on the sheet it is the document's own masthead.
  const wordmark = (
    <div
      style={{
        position: "absolute",
        top: 52,
        left: 80,
        display: "flex",
        fontFamily: "Anton",
        fontSize: 30,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: STAMP,
      }}
    >
      Terserah
    </div>
  );

  if (!room) {
    return new ImageResponse(
      (
        <div
          style={{
            ...size,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            background: INK,
            padding: 80,
          }}
        >
          {wordmark}
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
            position: "relative",
            background: INK,
            padding: 80,
            borderTop: `14px solid ${STAMP}`,
          }}
        >
          {wordmark}
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
              flexDirection: "column",
              borderBottom: `2px solid ${INK_LINE}33`,
              paddingBottom: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Anton",
                fontSize: 34,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: STAMP_DEEP,
              }}
            >
              Terserah
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <div style={{ ...label, color: DECREE_MUTED, display: "flex" }}>
                Perkara No. {id.toUpperCase()}
              </div>
              <div style={{ ...label, color: DECREE_MUTED, display: "flex" }}>
                {SITE_DOMAIN}
              </div>
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
