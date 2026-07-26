import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/og-fonts";
import { SITE_DOMAIN } from "@/lib/site";

// The landing had no OG image at all: sharing the bare domain rendered a text
// card with no mark on it. This is the summons masthead, same composition as
// the page's own hero.
export const alt = "Terserah — pengadilan buat yang bilang terserah";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#150d0c";
const STAMP = "#db2c2b";
const BONE = "#e8e3e1";
const MUTED = "#a09694";

export default function OpengraphImage() {
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
        <div
          style={{
            display: "flex",
            fontFamily: "Courier",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 3.4,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Pengadilan Terserah · Sidang terbuka
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Anton",
            fontSize: 132,
            lineHeight: 0.92,
            textTransform: "uppercase",
            marginTop: 26,
          }}
        >
          <div style={{ display: "flex", color: BONE }}>Dia bilang</div>
          <div style={{ display: "flex", color: STAMP }}>Terserah.</div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Courier",
            fontSize: 28,
            color: MUTED,
            marginTop: 34,
          }}
        >
          Tetapkan satu tempat. Putusannya berlaku begitu dia buka linknya.
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Courier",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: 3.4,
            textTransform: "uppercase",
            color: MUTED,
            marginTop: 44,
          }}
        >
          {SITE_DOMAIN}
        </div>
      </div>
    ),
    { ...size, fonts: ogFonts() },
  );
}
