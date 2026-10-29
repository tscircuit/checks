import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { outline } from "../fixtures/connector-explicit-outline"

test("offset outline exposes a false microSD warning independently of HDMI metadata", async () => {
  const panels: string[] = []
  const outdir = await mkdtemp(join(import.meta.dir, ".connector-outline-"))
  let cases: AnyCircuitElement[][]
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        resolve(
          import.meta.dir,
          "../fixtures/build-connector-explicit-outline.ts",
        ),
        outdir,
      ],
      { stdout: "inherit", stderr: "inherit" },
    )
    expect(await child.exited).toBe(0)
    cases = await Bun.file(join(outdir, "circuits.json")).json()
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
  const geometry = (json: AnyCircuitElement[]) =>
    json.filter((e) =>
      [
        "pcb_board",
        "pcb_smtpad",
        "pcb_plated_hole",
        "pcb_courtyard_rect",
      ].includes(e.type),
    )
  expect(geometry(cases[0])).toEqual(geometry(cases[1]))
  expect(cases[0].filter((e) => e.type === "pcb_smtpad")).toHaveLength(33)
  expect(cases[0].filter((e) => e.type === "pcb_plated_hole")).toHaveLength(4)
  for (const explicit of [false, true]) {
    const circuitJson = cases[explicit ? 1 : 0]
    expect(circuitJson.find((e) => e.type === "pcb_board")).toMatchObject({
      center: { x: 0, y: 0 },
      width: 75,
      height: 55,
      outline,
    })
    const components = circuitJson.filter((e) => e.type === "pcb_component")
    expect(components).toMatchObject([
      { center: { x: -16.4 }, rotation: 270 },
      { center: { x: 44.625, y: -20 }, rotation: 0 },
    ])
    expect(components[0].center.y).toBeCloseTo(-17.5, 10)
    expect(components.map((c) => c.insertion_direction)).toEqual(
      explicit ? ["from_left", "from_right"] : [undefined, undefined],
    )
    const warnings = circuitJson.filter(
      (e) => e.type === "pcb_connector_not_in_accessible_orientation_warning",
    )
    // microSD faces the actual nearest edge, with or without explicit metadata.
    expect(warnings).toHaveLength(explicit ? 0 : 1)
    if (!explicit) {
      expect(warnings[0]).toMatchObject({
        pcb_component_id: components[1].pcb_component_id,
        facing_direction: "x-",
        recommended_facing_direction: "x+",
      })
    }
    // Abbreviate labels only for display. Assertions above use native diagnostics.
    const drawing = convertCircuitJsonToPcbSvg(
      circuitJson
        .filter(
          (e) =>
            !e.type.endsWith("_error") &&
            (!e.type.endsWith("_warning") ||
              warnings.includes(e as (typeof warnings)[number])),
        )
        .map((e) =>
          e.type === "pcb_connector_not_in_accessible_orientation_warning"
            ? {
                ...e,
                message: `${e.pcb_component_id === components[0].pcb_component_id ? "microSD" : "HDMI"}: ${e.facing_direction} → ${e.recommended_facing_direction}`,
              }
            : e,
        ),
      {
        width: 700,
        height: 500,
        shouldDrawErrors: true,
        shouldDrawWarnings: true,
        showCourtyards: true,
        viewport: { minX: -32, maxX: 58, minY: -34, maxY: 30 },
      },
    )
    const status =
      warnings
        .map(
          (w) =>
            `${w.pcb_component_id === components[0].pcb_component_id ? "microSD" : "HDMI"}: ${w.facing_direction} → ${w.recommended_facing_direction}`,
        )
        .join("; ") || "No orientation warnings"
    panels.push(`<g transform="translate(${explicit ? 700 : 0},0)">
      <text x="24" y="38" font-size="22">${explicit ? "Explicit physical insertion directions" : "Original pad-only inference"}</text>
      <g transform="translate(0,60)">${drawing}</g>
      <text x="24" y="595" font-size="17" fill="${warnings.length ? "#b45309" : "#15803d"}">Checker: ${status}</text>
      <text x="24" y="625" font-size="15">${explicit ? "Metadata changes only; connector positions and copper are identical." : "HDMI needs from_right metadata; its hardware already opens right."}</text>
    </g>`)
  }
  await expect(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="710" viewBox="0 0 1400 710">
    <rect width="1400" height="710" fill="#f8fafc"/>
    <g font-family="sans-serif" fill="#111827">${panels.join("")}
      <text x="24" y="670" font-size="17">Inspect microSD: the real left edge is closer. A recommendation to face down is a false positive.</text>
      <text x="24" y="696" font-size="15">75 × 55 mm at center (0,0); the explicit outline is offset. Geometry is unchanged between panels and revisions.</text>
    </g></svg>`).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
