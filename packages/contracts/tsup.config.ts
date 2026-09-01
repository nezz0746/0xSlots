import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    abis: "src/abis.ts",
    addresses: "src/addresses.ts",
    slots: "src/slots.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
