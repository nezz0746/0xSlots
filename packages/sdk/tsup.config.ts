import { defineConfig } from "tsup";

export default defineConfig({
  // `zod` is its own entry so the root stays free of it. It is an optional peer
  // dependency — `z.toJSONSchema` is Zod 4 only — and bundling it into index
  // would break every consumer still on 3.x over a function they never call.
  entry: ["src/index.ts", "src/react.ts", "src/zod.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
