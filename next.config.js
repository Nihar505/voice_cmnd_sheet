/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // For audio file uploads
    },
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), 'canvas', 'jsdom'];
    return config;
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  images: {
    domains: ['lh3.googleusercontent.com'], // For Google profile images
  },
};

module.exports = nextConfig;
