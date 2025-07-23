/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    domains: ['npeajhtemjbcpnhsqknf.supabase.co', 'tradebusinessschool.com']
  },
  reactStrictMode: true,
  swcMinify: false, // Disable SWC minification
  compiler: {
    removeConsole: {
      exclude: ['error'],
    },
  },
};

module.exports = nextConfig; 