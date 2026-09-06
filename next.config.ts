import type { NextConfig } from 'next'

/**
 * Headers sent with every response.
 *
 * This app holds one person's whole life and has no reason to appear inside
 * anyone else's page, to guess at content types, or to hand a full URL to a
 * third party. None of these replace the real boundary - RLS and the owner
 * filter in every query - they just close the cheap doors.
 */
const SECURITY_HEADERS = [
  // Nobody may frame this: clickjacking a confirm button is a real way to
  // delete someone's data with one stolen click.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // An outbound link should not carry the path it came from: /goals?focus=<id>
  // says more about a person than a referrer needs to.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
