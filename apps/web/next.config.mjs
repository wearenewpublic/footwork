/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // atproto OAuth requires the 127.0.0.1 loopback host; allow its dev resources
  // (Next 16 treats 127.0.0.1 and localhost as distinct origins).
  allowedDevOrigins: ["127.0.0.1"],
  // relational-text-react ships TS source only (no dist) — transpile it here.
  transpilePackages: ["relational-text-react"],
};
export default nextConfig;
