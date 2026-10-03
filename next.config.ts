import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/cadastro/individual", destination: "/cadastro/pessoas", permanent: false },
      { source: "/cadastro/familiar", destination: "/cadastro/familia", permanent: false },
    ];
  },
};

export default nextConfig;
