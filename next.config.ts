import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 关闭 X-Powered-By(安全:不暴露框架)
  poweredByHeader: false,

  // 安全 headers(所有响应)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // 未来头像/食物图片可能外链,先配白名单占位
  images: {
    remotePatterns: [
      // 例:{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
