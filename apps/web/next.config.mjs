/** @type {import('next').NextConfig} */
const landWeaverApiHostport = process.env.LANDWEAVER_API_HOSTPORT?.trim();
const landWeaverApiBase =
  process.env.LANDWEAVER_API_BASE_URL?.trim() ||
  (landWeaverApiHostport ? `http://${landWeaverApiHostport}` : "http://127.0.0.1:8001");

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${landWeaverApiBase}/api/:path*`
      },
      {
        source: "/exports/:path*",
        destination: `${landWeaverApiBase}/exports/:path*`
      }
    ];
  }
};

export default nextConfig;
