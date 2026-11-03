/** @type {import('next').NextConfig} */
const WB = 'https://wb.ladebuid.com';

const nextConfig = {
  // 2026-11-03 Invest Lab 和研究工具拆到 wb.ladebuid.com（仓库 jerryhub366/workbench），旧链接永久跳过去。
  async redirects() {
    return [
      { source: '/lab/tools', destination: `${WB}/tools`, permanent: true },
      { source: '/lab/tools/:path*', destination: `${WB}/tools/:path*`, permanent: true },
      { source: '/lab', destination: `${WB}/lab`, permanent: true },
      { source: '/lab/:path*', destination: `${WB}/lab/:path*`, permanent: true },
      { source: '/api/lab/:path*', destination: `${WB}/api/lab/:path*`, permanent: true },
    ];
  },
};

module.exports = nextConfig;
