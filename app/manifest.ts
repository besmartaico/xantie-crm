import { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Xantie CRM',
    short_name: 'Xantie',
    start_url: '/admin',
    display: 'standalone',
    background_color: '#131313',
    theme_color: '#6366f1',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}