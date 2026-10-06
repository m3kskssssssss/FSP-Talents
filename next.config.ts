import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const isolation = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  serverExternalPackages: ["@node-rs/argon2", "postgres", "unpdf", "@react-pdf/renderer", "sql.js"],
  outputFileTracingIncludes: { "/**": ["./node_modules/sql.js/dist/sql-wasm.wasm", "./server/pdf/fonts/**"] },
  typedRoutes: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Cross-origin isolation only for the test runner: enables SharedArrayBuffer
        // so Pyodide can be interrupted. Must be entered with a full page load.
        source: "/test/:path*",
        headers: isolation,
      },
      { source: "/runner/:path*", headers: isolation },
    ];
  },
};

export default nextConfig;
