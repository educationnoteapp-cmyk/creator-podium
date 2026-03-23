/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'fzeupxiivncgifbyxqjy.supabase.co' },
      { protocol: 'https', hostname: '**' },
    ],
  },
}

module.exports = nextConfig
