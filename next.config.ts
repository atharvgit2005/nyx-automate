import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Legacy deep-link safety net: pre-split, this app lived under an
  // /automate/* prefix on the marketing domain. Anyone with an old
  // bookmark lands on the flattened standalone route.
  async redirects() {
    return [
      {
        source: '/automate/:path*',
        destination: '/:path*',
        permanent: true,
      },
      {
        source: '/automate',
        destination: '/',
        permanent: true,
      },
    ];
  },
  outputFileTracingRoot: __dirname,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Allow SVGs from DiceBear (avatar generator returns image/svg+xml)
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'avatar.vercel.sh' },
      // Google OAuth avatars
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // GitHub OAuth avatars
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // Twitter/X OAuth avatars
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: '*.dicebear.com' },
    ],
  },
};

export default nextConfig;
