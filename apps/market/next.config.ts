import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@0xslots/sdk", "@0xslots/contracts", "@0xslots/wallet"],
};

export default config;
