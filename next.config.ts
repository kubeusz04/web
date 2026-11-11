import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  // Native addons load adjacent runtime libraries that static tracing can miss.
  outputFileTracingIncludes: { "/*": ["./node_modules/@img/sharp-*/lib/**/*"] },
  logging: false,
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com`,
          },
        ],
      },
    ];
  },
};
export default config;
