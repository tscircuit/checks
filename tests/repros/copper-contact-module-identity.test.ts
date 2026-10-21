import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("motor-controller GND contact crashes routing DRC with independent Flatten instances", async () => {
  // Keep the bundle under the repository so external packages resolve normally.
  const outdir = await mkdtemp(join(import.meta.dir, ".copper-contact-"))
  try {
    // Exercise a consumer bundle independently of the test runner's module cache.
    const child = Bun.spawn(
      [
        process.execPath,
        resolve(import.meta.dir, "../fixtures/build-copper-contact-repro.ts"),
        outdir,
      ],
      { stdout: "inherit", stderr: "inherit" },
    )
    expect(await child.exited).toBe(0)
    const circuitJson: AnyCircuitElement[] = await Bun.file(
      join(outdir, "circuit.json"),
    ).json()
    const traces = circuitJson.filter((e) => e.type === "pcb_trace")
    // Keep the original board's route coordinates, width, and layer.
    expect(traces).toMatchObject([
      {
        route: [
          { x: -15.9, y: -22.9, width: 0.2, layer: "bottom" },
          { x: -15.9, y: -23.9, width: 0.2, layer: "bottom" },
          { x: -16.055891, y: -24.055891, width: 0.2, layer: "bottom" },
        ],
      },
    ])
    expect(
      circuitJson.filter((e) => e.type === "pcb_copper_pour"),
    ).toHaveLength(1)
    expect(circuitJson.filter((e) => e.type.endsWith("_error"))).toEqual([
      expect.objectContaining({
        type: "source_runtime_error",
        phase_name: "PcbDesignRuleChecks",
        message:
          "DRC could not complete (routing): undefined is not an object (evaluating 'edge.distanceTo(candidate.shape)[0]')",
      }),
    ])
    await expect(
      convertCircuitJsonToPcbSvg(circuitJson, {
        width: 1200,
        height: 700,
        layer: "bottom",
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)
    // X-Ray exposes the trace where ordinary rendering merges it into the pour.
    await expect(
      convertCircuitJsonToPcbSvg(circuitJson, {
        width: 1200,
        height: 700,
        layer: "bottom",
        xRayElementIds: traces.map((trace) => trace.pcb_trace_id),
      }),
    ).toMatchSvgSnapshot(
      import.meta.path,
      "copper-contact-module-identity-detail",
    )
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
}, 30_000)
