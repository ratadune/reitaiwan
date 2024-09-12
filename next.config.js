/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.BASE_PATH || "",
  basePath: process.env.BASE_PATH || "/reitaiwan",
  trailingSlash: true,
  publicRuntimeConfig: {
    root: process.env.BASE_PATH || "/reitaiwan",
  },
  optimizeFonts: false,
};

module.exports = nextConfig;
