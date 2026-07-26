import { ImageResponse } from "next/og";

// Safari ignores SVG for apple-touch-icon, so the home-screen mark is a real
// raster. Same geometry as app/icon.svg at 5.625x, built from two blocks
// rather than set in Anton — one letterform for both sizes, and no font
// payload on an icon request.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          ...size,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#db2c2b",
        }}
      >
        <div style={{ display: "flex", width: 84, height: 34, background: "#f0e9e7" }} />
        <div style={{ display: "flex", width: 34, height: 90, background: "#f0e9e7" }} />
      </div>
    ),
    size,
  );
}
