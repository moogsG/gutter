import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "@lancedb/lancedb",
    "@xenova/transformers",
  ],

  // 🛡️ Security Headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Prevent clickjacking attacks
          {
            key: "X-Frame-Options",
            value: "DENY",
          },

          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          // Control referrer information leakage
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          // Content Security Policy - prevents XSS attacks
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' http://localhost:11434",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },

          // Permissions Policy - restrict browser features
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=(self)", // Allow microphone for voice transcription
              "geolocation=()",
              "payment=()",
            ].join(", "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
