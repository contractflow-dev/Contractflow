import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contractflow/contracts-schema", "@workspace/ui"],
};

export default nextConfig;
