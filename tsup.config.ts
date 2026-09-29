import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  noExternal: [
    "@tscircuit/circuit-json-schematic-placement-analysis",
    // The bundled analysis imports calculate-elbow source; keep it inside our
    // JS bundle rather than leaking a private directory import to Node.
    "calculate-elbow",
    "@tscircuit/jlcpcb-manufacturing-specs",
    "@tscircuit/circuit-json-to-flattenjs",
  ],
})
