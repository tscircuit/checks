import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  // Drop unused renderer imports re-exported by graphics-debug after bundling.
  treeshake: { moduleSideEffects: "no-external" },
  noExternal: [
    "@tscircuit/circuit-json-schematic-placement-analysis",
    "@tscircuit/solver-utils",
    "calculate-elbow",
    "graphics-debug",
    "@tscircuit/jlcpcb-manufacturing-specs",
    "@tscircuit/circuit-json-to-flattenjs",
  ],
})
