import path from "node:path";
import type { NextConfig } from "next";

// The Docker image sets NEXT_OUTPUT=standalone; Render keeps using `next start`.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  transpilePackages: ["@contractflow/contracts-schema", "@workspace/ui"],
  ...(standalone && {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, "../../"),
  }),
};

export default nextConfig;
