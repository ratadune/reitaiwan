/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: true,
  publicRuntimeConfig: {
    root: process.env.NEXT_PUBLIC_BASE_PATH || "",
  },
  optimizeFonts: false,
};

module.exports = nextConfig;
