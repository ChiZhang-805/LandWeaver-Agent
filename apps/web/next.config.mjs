/** @type {import('next').NextConfig} */
const landWeaverApiBase = process.env.LANDWEAVER_API_BASE_URL || "http://127.0.0.1:8001";

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${landWeaverApiBase}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
