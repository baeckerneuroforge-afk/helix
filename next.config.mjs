/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the foundation strict and explicit. No experimental features needed yet.
  reactStrictMode: true,

  // Baseline security headers on every response (Phase 12). A CSP is NOT set
  // here yet: Next's inline runtime needs nonces/hashes — introduce it via
  // middleware when the surface stabilizes, don't ship a lax one.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
