import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: 'www.lamanitodelvegano.cl' }],
      destination: 'https://lamanitodelvegano.cl/:path*',
      permanent: true,
    }];
  },
};

export default nextConfig;
