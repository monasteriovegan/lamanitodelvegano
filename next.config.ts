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
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          has: [{ type: 'host', value: 'demo.lamanitodelvegano.cl' }],
          destination: '/demo/bombones-v6.html',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
