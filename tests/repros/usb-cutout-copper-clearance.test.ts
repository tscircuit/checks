import { expect, test } from "bun:test"
import type { AnyCircuitElement, LayerRef } from "circuit-json"
import { runAllPlacementChecks, runAllRoutingChecks } from "../../index"
import { renderCutoutClearanceProof } from "../fixtures/render-cutout-clearance-proof"

// A milled slot removes FR4 and copper on every layer. This is the USB4145
// supplier footprint's capsule polygon, translated to the center of the board.
// Board/circuit coordinates in mm: +X right, +Y up; all values are points.
const cutout = {
  type: "pcb_cutout",
  pcb_cutout_id: "usb_locating_slot",
  shape: "polygon",
  points: [
    { x: -0.7549895, y: -0.0000005 },
    { x: -0.7074295, y: -0.1774955 },
    { x: -0.5774945, y: -0.3074305 },
    { x: -0.3999995, y: -0.3549905 },
    { x: 0.3999995, y: -0.3549905 },
    { x: 0.5774945, y: -0.3074305 },
    { x: 0.7074305, y: -0.1774955 },
    { x: 0.7549895, y: -0.0000005 },
    { x: 0.7074305, y: 0.1774955 },
    { x: 0.5774945, y: 0.3074305 },
    { x: 0.3999995, y: 0.3549905 },
    { x: -0.3999995, y: 0.3549905 },
    { x: -0.5774945, y: 0.3074305 },
    { x: -0.7074295, y: 0.1774955 },
  ],
} satisfies AnyCircuitElement

const makeCircuit = (
  copper: AnyCircuitElement[],
  includeCutout = true,
): AnyCircuitElement[] => [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 8,
    height: 6,
    thickness: 1.6,
    num_layers: 4,
    material: "fr4",
    min_board_edge_clearance: 0.1,
    min_trace_to_hole_edge_clearance: 0.1,
  },
  ...(includeCutout ? [cutout] : []),
  ...copper,
]

const runCopperChecks = async (circuitJson: AnyCircuitElement[]) => [
  ...(await runAllPlacementChecks(circuitJson)),
  ...(await runAllRoutingChecks(circuitJson)),
]

for (const named of [true, false]) {
  for (const layer of ["top", "inner1", "inner2", "bottom"] as LayerRef[]) {
    const copper: AnyCircuitElement[] = [
      ...(named
        ? [
            {
              type: "source_trace" as const,
              source_trace_id: "sense_trace",
              display_name: "VM_TO_ADC_DIVIDER",
              connected_source_port_ids: [],
              connected_source_net_ids: [],
            },
          ]
        : []),
      ...([-2, 2] as const).map((x) => ({
        type: "pcb_plated_hole" as const,
        pcb_plated_hole_id: `terminal_hole_${x}`,
        pcb_port_id: `terminal_port_${x}`,
        shape: "circle" as const,
        x,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.8,
        layers: ["top", "inner1", "inner2", "bottom"] as LayerRef[],
      })),
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_across_slot",
        ...(named ? { source_trace_id: "sense_trace" } : {}),
        route: [
          {
            route_type: "wire",
            x: -2,
            y: 0,
            width: 0.56,
            layer,
            start_pcb_port_id: "terminal_port_-2",
          },
          {
            route_type: "wire",
            x: 2,
            y: 0,
            width: 0.56,
            layer,
            end_pcb_port_id: "terminal_port_2",
          },
        ],
      },
    ]

    test(`${named ? "named" : "unnamed"} ${layer} trace fixture runs and renders`, async () => {
      // Same copper inside the external board boundary is valid without a slot.
      expect(await runCopperChecks(makeCircuit(copper, false))).toEqual([])
      const circuitJson = makeCircuit(copper)
      const errors = await runCopperChecks(circuitJson)

      if (named && layer === "top") {
        expect(
          renderCutoutClearanceProof(circuitJson, errors),
        ).toMatchSvgSnapshot(import.meta.path)
      }

      expect(errors.every((error) => /cutout|slot/i.test(error.message))).toBe(
        true,
      )
    })

    // Expected failure until the cutout check lands. Fixture and snapshot
    // failures above remain ordinary failures and cannot satisfy this test.
    test.failing(
      `reports ${named ? "named" : "unnamed"} ${layer} trace crossing a milled slot`,
      async () => {
        const errors = await runCopperChecks(makeCircuit(copper))
        expect(errors.some((error) => /cutout|slot/i.test(error.message))).toBe(
          true,
        )
      },
    )
  }
}

const standaloneVia: AnyCircuitElement[] = [
  {
    type: "pcb_via",
    pcb_via_id: "via_inside_slot",
    x: 0,
    y: 0,
    hole_diameter: 0.3,
    outer_diameter: 0.45,
    layers: ["top", "inner1", "inner2", "bottom"],
  },
]

const routeEmbeddedVia: AnyCircuitElement[] = [
  {
    type: "pcb_trace",
    pcb_trace_id: "via_only_trace",
    route: [
      {
        route_type: "via",
        x: 0,
        y: 0,
        from_layer: "top",
        to_layer: "bottom",
        hole_diameter: 0.3,
        outer_diameter: 0.45,
      },
    ],
  },
]

for (const { name, copper } of [
  { name: "standalone through-via", copper: standaloneVia },
  { name: "route-embedded via", copper: routeEmbeddedVia },
]) {
  test(`${name} fixture runs with and without a milled slot`, async () => {
    expect(await runCopperChecks(makeCircuit(copper, false))).toEqual([])
    const errors = await runCopperChecks(makeCircuit(copper))
    expect(errors.every((error) => /cutout|slot/i.test(error.message))).toBe(
      true,
    )
  })

  test.failing(`reports a ${name} inside a milled slot`, async () => {
    const errors = await runCopperChecks(makeCircuit(copper))
    expect(errors.some((error) => /cutout|slot/i.test(error.message))).toBe(
      true,
    )
  })
}
