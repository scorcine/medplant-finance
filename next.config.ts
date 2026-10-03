import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/cadastro/individual", destination: "/cadastro/pessoas", permanent: false },
      { source: "/cadastro/familiar", destination: "/cadastro/familia", permanent: false },
      { source: "/plantoes", destination: "/agenda", permanent: false },
    ];
  },
};

export default nextConfig;
