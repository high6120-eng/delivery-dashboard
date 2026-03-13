/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // 빌드 시 타입 에러가 있어도 무시하고 배포 진행
    ignoreBuildErrors: true,
  },
  eslint: {
    // 빌드 시 린트(문법 검사) 에러가 있어도 무시
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;