/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export (REQUIREMENTS §7A): no Next.js server, no API routes/SSR.
  // All server logic lives in Supabase. The export is hosted as static files.
  output: 'export',
  images: { unoptimized: true }, // no server to optimize images
  reactStrictMode: true,
};

export default nextConfig;
