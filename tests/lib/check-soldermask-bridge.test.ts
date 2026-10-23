import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSoldermaskBridge } from "lib/check-soldermask-bridge"
import { runAllChecks, runAllPlacementChecks } from "lib/run-all-checks"

test("well spaced solder-mask openings produce no errors", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_soldermask_bridge: 0.1,
    } as any,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: -2,
      y: 0,
      width: 0.5,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad2",
      shape: "rect",
      x: 2,
      y: 0,
      width: 0.5,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
  ]

  const errors = checkSoldermaskBridge(circuitJson, { minBridge: 0.1 })
  expect(errors).toHaveLength(0)
})

test("reproduces issue #5559: detects narrow 0.02 mm solder-mask bridge between IC pads", () => {
  // From issue #5559 item 5:
  // <chip name="U1" pcbX={0} pcbY={0} footprint={
  //   <footprint>
  //     <smtpad portHints={["pin1"]} shape="rect" pcbX={-0.235} pcbY={0} width={0.35} height={1} solderMaskMargin={0.05} />
  //     <smtpad portHints={["pin2"]} shape="rect" pcbX={0.235} pcbY={0} width={0.35} height={1} solderMaskMargin={0.05} />
  //   </footprint>
  // } />
  // F_Mask.gbr contains two R,0.45x1.1 openings centered +-0.235 mm apart, leaving a 0.02 mm web.
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_soldermask_bridge: 0.1,
    } as any,
    {
      type: "source_component",
      source_component_id: "chip_u1",
      name: "U1",
      ftype: "simple_chip",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_u1",
      source_component_id: "chip_u1",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 0,
      width: 2,
      height: 2,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "u1_pin1",
      pcb_component_id: "pcb_u1",
      port_hints: ["pin1"],
      shape: "rect",
      x: -0.235,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "u1_pin2",
      pcb_component_id: "pcb_u1",
      port_hints: ["pin2"],
      shape: "rect",
      x: 0.235,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
  ]

  const errors = checkSoldermaskBridge(circuitJson, { minBridge: 0.1 })
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_placement_error")
  expect(errors[0].message).toContain("0.02mm")
  expect(errors[0].message).toContain("0.1mm")
  expect(errors[0].message).toContain("top layer")
})

test("tented pads produce no solder-mask openings or errors", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "tented_pad1",
      shape: "rect",
      x: -0.2,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      is_covered_with_solder_mask: true,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "tented_pad2",
      shape: "rect",
      x: 0.2,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      is_covered_with_solder_mask: true,
      layer: "top",
    },
  ]

  const errors = checkSoldermaskBridge(circuitJson, { minBridge: 0.1 })
  expect(errors).toHaveLength(0)
})

test("pads on opposite layers do not conflict", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "top_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "bottom_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      layer: "bottom",
    },
  ]

  const errors = checkSoldermaskBridge(circuitJson, { minBridge: 0.1 })
  expect(errors).toHaveLength(0)
})

test("detects narrow bridge between plated hole and smt pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pth1",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1.0,
      hole_diameter: 0.6,
      soldermask_margin: 0.05,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_near_pth",
      shape: "rect",
      x: 0.8,
      y: 0,
      width: 0.4,
      height: 0.4,
      soldermask_margin: 0.05,
      layer: "top",
    },
  ]
  // PTH top opening radius = 0.5 + 0.05 = 0.55 (spans x: [-0.55, 0.55])
  // Pad opening = 0.4 + 0.1 = 0.5 (spans x: [0.8 - 0.25, 0.8 + 0.25] = [0.55, 1.05])
  // Gap = 0.55 - 0.55 = 0.00 mm (< 0.10 mm)

  const errors = checkSoldermaskBridge(circuitJson, { minBridge: 0.1 })
  expect(errors.length).toBeGreaterThanOrEqual(1)
  expect(errors[0].message).toContain("Solder-mask bridge")
})

test("is included in runAllPlacementChecks and runAllChecks when board specifies min_soldermask_bridge", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 50,
      height: 50,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
      min_soldermask_bridge: 0.1,
    } as any,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "p1",
      shape: "rect",
      x: -0.235,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "p2",
      shape: "rect",
      x: 0.235,
      y: 0,
      width: 0.35,
      height: 1,
      soldermask_margin: 0.05,
      layer: "top",
    },
  ]

  const placementErrors = await runAllPlacementChecks(circuitJson)
  expect(
    placementErrors.some((e) => e.message.includes("Solder-mask bridge")),
  ).toBe(true)

  const allErrors = await runAllChecks(circuitJson)
  expect(allErrors.some((e) => e.message.includes("Solder-mask bridge"))).toBe(
    true,
  )
})
