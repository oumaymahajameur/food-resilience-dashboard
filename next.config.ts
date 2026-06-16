// next.config.ts

const nextConfig = {
  reactStrictMode: true,  // Active le mode strict de React pour mieux repérer les erreurs
  swcMinify: true,        // Active la minification via SWC pour de meilleures performances
  images: {
    domains: ['example.com'],
  },
};

export default nextConfig;