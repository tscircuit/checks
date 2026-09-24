import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPadPadClearance } from "lib/check-pad-pad-clearance"
import { checkPlatedHoleDrillClearance } from "lib/check-plated-hole-drill-clearance"
import { runAllChecks } from "lib/run-all-checks"

const circleHole = (
  id: string,
  x: number,
  overrides: Record<string, unknown> = {},
): AnyCircuitElement =>
  ({
    type: "pcb_plated_hole",
    shape: "circle",
    pcb_plated_hole_id: id,
    x,
    y: 0,
    hole_diameter: 0.4,
    outer_diameter: 0.7,
    layers: ["top", "bottom"],
    ...overrides,
  }) as AnyCircuitElement

// Two plated holes wired to the same net by a real pcb_trace. Annular rings are
// 0.05mm so the copper does not overlap, but the drills sit 0.12mm apart, under
// the 0.15mm minimum drill edge to drill edge clearance. runAllChecks returns
// nothing for this board before this check exists.
const sameNetTooCloseBoard = (): AnyCircuitElement[] =>
  [
    {
      type: "pcb_plated_hole",
      shape: "circle",
      pcb_plated_hole_id: "PH1",
      pcb_port_id: "pp1",
      x: 0,
      y: 0,
      hole_diameter: 0.5,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      shape: "circle",
      pcb_plated_hole_id: "PH2",
      pcb_port_id: "pp2",
      x: 0.62,
      y: 0,
      hole_diameter: 0.5,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp1",
      source_port_id: "sp1",
      pcb_component_id: "C1",
      layers: ["top"],
      x: 0,
      y: 0,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp2",
      source_port_id: "sp2",
      pcb_component_id: "C1",
      layers: ["top"],
      x: 0.62,
      y: 0,
    },
    {
      type: "source_trace",
      source_trace_id: "st1",
      connected_source_port_ids: ["sp1", "sp2"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pt1",
      source_trace_id: "st1",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.1,
          layer: "top",
          start_pcb_port_id: "pp1",
        },
        {
          route_type: "wire",
          x: 0.62,
          y: 0,
          width: 0.1,
          layer: "top",
          end_pcb_port_id: "pp2",
        },
      ],
    },
  ] as AnyCircuitElement[]

describe("checkPlatedHoleDrillClearance", () => {
  test("returns an error when two plated hole drills are too close", () => {
    // Centers 0.5mm apart, 0.4mm drills: drill gap 0.1mm, under the 0.15mm minimum.
    const soup = [circleHole("ph1", 0), circleHole("ph2", 0.5)]
    const errors = checkPlatedHoleDrillClearance(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe("pcb_pad_pad_clearance_error")
    expect(errors[0].message).toContain("drill holes spaced too closely")
    expect(errors[0].pcb_pad_ids.sort()).toEqual(["ph1", "ph2"])
    expect(errors[0].minimum_clearance).toBeCloseTo(0.15, 10)
    expect(errors[0].actual_clearance).toBeCloseTo(0.1, 10)
  })

  test("returns no error when plated hole drills are sufficiently spaced", () => {
    const soup = [circleHole("ph1", 0), circleHole("ph2", 1.2)]
    expect(checkPlatedHoleDrillClearance(soup)).toHaveLength(0)
  })

  test("flags oval plated hole drills that are too close", () => {
    // Pill drills 0.6 x 0.3 with the long axis along x. The capsule ends sit
    // 0.4mm apart, so the drill gap is 0.4 - 0.15 - 0.15 = 0.1mm.
    const oval = (id: string, x: number): AnyCircuitElement =>
      ({
        type: "pcb_plated_hole",
        shape: "oval",
        pcb_plated_hole_id: id,
        x,
        y: 0,
        hole_width: 0.6,
        hole_height: 0.3,
        outer_width: 0.9,
        outer_height: 0.6,
        ccw_rotation: 0,
        layers: ["top", "bottom"],
      }) as AnyCircuitElement
    expect(
      checkPlatedHoleDrillClearance([oval("ph1", 0), oval("ph2", 0.7)]),
    ).toHaveLength(1)
  })

  test("returns no error for coincident duplicate plated holes", () => {
    expect(
      checkPlatedHoleDrillClearance([
        circleHole("ph1", 0),
        circleHole("ph2", 0),
      ]),
    ).toHaveLength(0)
  })

  test("copper pad clearance skips same-net holes but drill spacing still applies", () => {
    const soup = sameNetTooCloseBoard()
    // Copper pad-pad clearance intentionally skips same-net pairs.
    expect(checkPadPadClearance(soup)).toHaveLength(0)
    // Drill spacing is a fabrication constraint, so it must still flag them.
    expect(checkPlatedHoleDrillClearance(soup)).toHaveLength(1)
  })

  test("runAllChecks reports the same-net drill spacing that no other check catches", async () => {
    const errors = await runAllChecks(sameNetTooCloseBoard())
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe("pcb_pad_pad_clearance_error")
    expect(
      (errors[0] as { pcb_pad_pad_clearance_error_id: string })
        .pcb_pad_pad_clearance_error_id,
    ).toContain("plated_hole_drill_clearance_")
  })

  test("visual snapshot of two plated holes drilled too close", () => {
    const soup = sameNetTooCloseBoard()
    soup.unshift({
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0.31, y: 0 },
      width: 4,
      height: 4,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    } as AnyCircuitElement)

    const errors = checkPlatedHoleDrillClearance(soup)
    expect(errors).toHaveLength(1)

    expect(
      convertCircuitJsonToPcbSvg([...soup, ...errors], {
        shouldDrawErrors: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)
  })
})
