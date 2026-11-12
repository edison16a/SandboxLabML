import type { NextConfig } from 'next';

/**
 * The app is fully client side: training runs in Web Workers and data lives in
 * IndexedDB, so the config mostly adds security headers. Scripts never run
 * through eval, which lets the CSP leave out 'unsafe-eval' in production.
 * 'wasm-unsafe-eval' lets the old landing showcase load its physics WASM;
 * neither lab needs it, so it goes when that showcase does.
 */
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['three'],
  /** The two first labs gave way to Driving and Navigation; old links land on their successors. */
  async redirects() {
    return [
      { source: '/lab/racing', destination: '/lab/driving', permanent: true },
      { source: '/lab/hide-seek', destination: '/lab/navigation', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
