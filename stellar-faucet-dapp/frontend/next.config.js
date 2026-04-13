/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stellar SDK uses Node.js built-ins that don't exist in the browser.
  // These fallbacks tell webpack to ignore them during the client bundle.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:     false,
        net:    false,
        tls:    false,
        crypto: false,
        path:   false,
        os:     false,
        stream: false,
        http:   false,
        https:  false,
        zlib:   false,
      };
    }
    return config;
  },

  // Silence the StellarSdk ESM warning in build output
  transpilePackages: ['@stellar/stellar-sdk'],
};

module.exports = nextConfig;
