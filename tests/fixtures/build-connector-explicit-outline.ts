import { join, resolve } from "node:path"
import type * as Repro from "./connector-explicit-outline"

const outdir = process.argv[2]
if (!outdir) throw new Error("Pass an output directory for the reproduction")

const build = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "connector-explicit-outline.tsx")],
  target: "bun",
  outdir,
  external: ["@tscircuit/copper-pour-solver"],
  plugins: [
    {
      name: "local-checks",
      setup(builder) {
        builder.onResolve({ filter: /^@tscircuit\/checks$/ }, () => ({
          path: resolve(import.meta.dir, "../../index.ts"),
        }))
      },
    },
  ],
})
if (!build.success) throw new AggregateError(build.logs, "Repro build failed")
const { renderConnectorOutlineRepro } = (await import(
  build.outputs[0].path
)) as typeof Repro
await Bun.write(
  join(outdir, "circuits.json"),
  JSON.stringify([
    await renderConnectorOutlineRepro(false),
    await renderConnectorOutlineRepro(true),
  ]),
)
