import type { NextConfig } from "next";

/**
 * Security headers. The security review found none of these present.
 *
 * They do not protect the data (grants and policies in Postgres do that, and the gate
 * proves it by attacking PostgREST directly). What they close is the browser side: an
 * attacker framing the login page, a response sniffed into a different content type, a
 * referrer carrying a path somewhere it should not go.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    // frame-ancestors is the modern half of X-Frame-Options and cannot be set in a meta tag.
    // Kept narrow on purpose: a full CSP for a Next app needs nonces, and a broken CSP that
    // has to be loosened later teaches everyone to ignore it.
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
