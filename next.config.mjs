/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization for pages with dynamic content
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['placeholder.svg'],
  },
  // Ensure all pages are server-side rendered
  experimental: {
    appDir: true,
  },
  // Increase API timeout
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb', // Reduce size limit to improve performance
    },
  },
  // Increase serverless function timeout (for Vercel)
  serverRuntimeConfig: {
    maxDuration: 60, // 60 seconds
  },
  // Optimize for serverless functions
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep the serverless function size small
      config.optimization.minimize = true;
    }
    return config;
  }
}

export default nextConfig

