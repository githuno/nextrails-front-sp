/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  headers: async () => [
    {
      source: "/api/proxy/radiko/:path*",
      headers: [
        {
          key: "Access-Control-Allow-Origin",
          value: "*",
        },
        {
          key: "Access-Control-Allow-Methods",
          value: "GET, OPTIONS",
        },
        {
          key: "Access-Control-Allow-Headers",
          value: "*",
        },
      ],
    },
  ],
  allowedDevOrigins: [
    "uno-pc.tail55100.ts.net",
    "mac-hono.tail55100.ts.net:10000",
  ],
};

module.exports = nextConfig;
