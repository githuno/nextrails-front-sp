/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverActions: {
      allowedOrigins: ["radiko.jp"],
    },
  },
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
};

module.exports = nextConfig;
