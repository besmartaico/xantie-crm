/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'time.xantie.com' }],
        destination: 'https://crm.xantie.com/:path*',
        permanent: true,
      },
    ]
  },
}
module.exports = nextConfig
