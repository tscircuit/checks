import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  noExternal: ["@tscircuit/jlcpcb-manufacturing-specs"],
})
