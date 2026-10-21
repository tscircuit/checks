import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("routing DRC crashes when copper contact uses independent Flatten instances", async () => {
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
    expect(circuitJson.filter((e) => e.type === "pcb_trace")).toHaveLength(1)
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
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
}, 30_000)
