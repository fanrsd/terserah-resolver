import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  // The OG route reads these at request time; tracing won't find them itself.
  outputFileTracingIncludes: {
    "/api/og/[id]": ["./assets/*.ttf"],
  },
};

export default config;
