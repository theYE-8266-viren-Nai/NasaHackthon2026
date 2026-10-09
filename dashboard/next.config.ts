import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(dashboardDir, "..")
};

export default nextConfig;
