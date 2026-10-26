import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/config/i18n-request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // LOT1: up to 3 compressed sticker photos (≤ 1.2 MB each) are sent with the visit form.
    // Stays under Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default withNextIntl(nextConfig);
