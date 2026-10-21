import { join, resolve } from "node:path"
import type * as Repro from "./copper-contact-module-identity"

const outdir = process.argv[2]
if (!outdir) throw new Error("Pass an output directory for the reproduction")

const build = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "copper-contact-module-identity.tsx")],
  target: "bun",
  outdir,
  external: [
    // The checker bundles Flatten; the geometry producer loads its own copy.
    "@tscircuit/circuit-json-util",
    // Keep the pour solver alongside its installed WASM assets.
    "@tscircuit/copper-pour-solver",
  ],
  plugins: [
    {
      name: "local-checks",
      setup(builder) {
        // Core must run this branch's checks, not its installed dependency.
        builder.onResolve({ filter: /^@tscircuit\/checks$/ }, () => ({
          path: resolve(import.meta.dir, "../../index.ts"),
        }))
      },
    },
  ],
})
if (!build.success) throw new AggregateError(build.logs, "Repro build failed")

const { renderRepro } = (await import(build.outputs[0].path)) as typeof Repro
await Bun.write(
  join(outdir, "circuit.json"),
  JSON.stringify(await renderRepro()),
)
