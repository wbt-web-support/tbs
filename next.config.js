/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    domains: ['npeajhtemjbcpnhsqknf.supabase.co']
  }
};

module.exports = nextConfig; 