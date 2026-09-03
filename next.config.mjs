/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // 商家可以貼任何 IG / 自家 CDN / Supabase storage 圖片，允許全 HTTPS
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // 商家頁六處 quality prop 各自用的值都要在這裡登記，不然 Next 16 會悄悄改成最接近的
    // 已登記值（quality={85} 被壓成 80、quality={78} 也被壓成 80）——hero 大圖跟相簿縮圖
    // 因此都比程式碼寫的值糊，且不會報錯，不查 next.config 對照表看不出來。
    qualities: [75, 78, 80, 85],
  },
};

export default nextConfig;
