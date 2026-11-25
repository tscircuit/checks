import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbCopperPour,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  SourceComponentBase,
} from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

type RoutePoint = PcbTrace["route"][number]

const wire = (x: number, y: number): RoutePoint => ({
  route_type: "wire",
  x,
  y,
  layer: "top",
  width: 0.2,
})

/** A source port, PCB port and top-layer SMD pad centered on the given point. */
const padAt = (name: string, x: number, y: number): AnyCircuitElement[] =>
  [
    {
      type: "source_port",
      source_port_id: `sp_${name}`,
      name,
      source_component_id: "component",
    },
    {
      type: "pcb_port",
      pcb_port_id: `pp_${name}`,
      source_port_id: `sp_${name}`,
      x,
      y,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad_${name}`,
      pcb_port_id: `pp_${name}`,
      shape: "rect",
      x,
      y,
      width: 0.5,
      height: 0.5,
      layer: "top",
    } satisfies PcbSmtPad,
  ] as AnyCircuitElement[]

const sourceTrace = (
  id: string,
  ports: string[],
  nets: string[] = [],
): AnyCircuitElement => ({
  type: "source_trace",
  source_trace_id: id,
  connected_source_port_ids: ports.map((port) => `sp_${port}`),
  connected_source_net_ids: nets,
})

const trace = (
  id: string,
  sourceTraceId: string,
  route: RoutePoint[],
): AnyCircuitElement => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  source_trace_id: sourceTraceId,
  route,
})

const missingConnections = (circuitJson: AnyCircuitElement[]) =>
  checkTracesAreContiguous(circuitJson)
    .map((error) => error.pcb_trace_error_id)
    .filter((id) => id.startsWith("missing_connection"))

// The real routing pattern from a stepper controller: a pull-up reaches a button's
// second leg, and the button's first leg reaches the MCU. Only the bond joins them.
function routedThroughSwitch(extra: AnyCircuitElement[]): AnyCircuitElement[] {
  return [
    ...padAt("R_pin1", 0, 0),
    ...padAt("SW_pin2", 3, 0),
    ...padAt("SW_pin1", 3, 3),
    ...padAt("U_RUN", 6, 3),
    sourceTrace("pull_up", ["R_pin1", "U_RUN"]),
    sourceTrace("button", ["SW_pin1", "U_RUN"]),
    trace("pull_up_copper", "pull_up", [wire(0, 0), wire(3, 0)]),
    trace("button_copper", "button", [wire(3, 3), wire(6, 3)]),
    ...extra,
  ]
}

const switchWithBond: AnyCircuitElement = {
  type: "source_component",
  source_component_id: "switch",
  ftype: "simple_push_button",
  name: "SW",
  internally_connected_source_port_ids: [["sp_SW_pin1", "sp_SW_pin2"]],
} as SourceComponentBase as AnyCircuitElement

test("a route through a component's internal bond reaches the required port", () => {
  expect(missingConnections(routedThroughSwitch([switchWithBond]))).toEqual([])
})

test("accepts a bond declared as a source_component_internal_connection", () => {
  expect(
    missingConnections(
      routedThroughSwitch([
        {
          type: "source_component_internal_connection",
          source_component_internal_connection_id: "bond",
          source_component_id: "switch",
          source_port_ids: ["sp_SW_pin1", "sp_SW_pin2"],
        },
      ]),
    ),
  ).toEqual([])
})

test("still reports the same gap when the component declares no bond", () => {
  expect(missingConnections(routedThroughSwitch([]))).toEqual([
    "missing_connection_pull_up_copper_pp_U_RUN",
  ])
})

test("a bond between other pins does not bridge the gap", () => {
  const unrelatedBond = {
    ...switchWithBond,
    internally_connected_source_port_ids: [["sp_SW_pin3", "sp_SW_pin4"]],
  } as AnyCircuitElement
  expect(missingConnections(routedThroughSwitch([unrelatedBond]))).toEqual([
    "missing_connection_pull_up_copper_pp_U_RUN",
  ])
})

test("landing on a required port's bonded partner reaches that port", () => {
  const route = (bond: AnyCircuitElement[]) => [
    ...padAt("R_pin1", 0, 0),
    ...padAt("SW_pin2", 3, 0),
    ...padAt("SW_pin1", 3, 3),
    sourceTrace("pull_up", ["R_pin1", "SW_pin1"]),
    trace("pull_up_copper", "pull_up", [wire(0, 0), wire(3, 0)]),
    ...bond,
  ]
  expect(missingConnections(route([switchWithBond]))).toEqual([])
  expect(missingConnections(route([]))).toEqual([
    "missing_connection_pull_up_copper_pp_SW_pin1",
  ])
})

// A fragment of a port-to-net connection stops elsewhere, while the port's own pad
// sits in that net's pour.
function portInPour(
  pourOverrides: {
    source_net_id?: string
    layer?: LayerRef
    center?: { x: number; y: number }
  } = {},
) {
  const hole: PcbPlatedHole = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "mount",
    pcb_port_id: "pp_MOUNT",
    shape: "circle",
    x: 5,
    y: 0,
    outer_diameter: 1,
    hole_diameter: 0.5,
    layers: ["top", "bottom"],
  }
  const pour: PcbCopperPour = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "gnd",
    layer: "bottom",
    covered_with_solder_mask: true,
    shape: "rect",
    center: { x: 5, y: 0 },
    width: 4,
    height: 4,
    rotation: 0,
    ...pourOverrides,
  }
  return [
    ...padAt("OTHER", 0, 0),
    {
      type: "source_port",
      source_port_id: "sp_MOUNT",
      name: "MOUNT",
      source_component_id: "component",
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_MOUNT",
      source_port_id: "sp_MOUNT",
      x: 5,
      y: 0,
      layers: ["top", "bottom"],
    },
    hole,
    sourceTrace("mount_to_gnd", ["MOUNT"], ["gnd"]),
    trace("stray", "mount_to_gnd", [wire(0, 0), wire(2, 0)]),
    pour,
  ] as AnyCircuitElement[]
}

test("a required port whose pad sits in a same-net pour is connected", () => {
  expect(missingConnections(portInPour())).toEqual([])
})

test("a pour on another net does not connect a required port", () => {
  expect(missingConnections(portInPour({ source_net_id: "vcc" }))).toEqual([
    "missing_connection_stray_pp_MOUNT",
  ])
})

test("a same-net pour on a layer the pad does not reach does not connect it", () => {
  expect(missingConnections(portInPour({ layer: "inner1" }))).toEqual([
    "missing_connection_stray_pp_MOUNT",
  ])
})

test("a same-net pour away from the pad does not connect it", () => {
  expect(missingConnections(portInPour({ center: { x: 15, y: 0 } }))).toEqual([
    "missing_connection_stray_pp_MOUNT",
  ])
})

// The polygon-edge bug hid real gaps from this check as well as from dangling ends.
test("a polygon pad with a repeated vertex does not hide a real gap", () => {
  const polygonPad = (points: { x: number; y: number }[]) =>
    [
      ...padAt("A", 0, 0),
      ...padAt("B", 10, 0),
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "polygon_pad",
        pcb_port_id: "pp_POLY",
        shape: "polygon",
        layer: "top",
        points,
      },
      {
        type: "source_port",
        source_port_id: "sp_POLY",
        name: "POLY",
        source_component_id: "component",
      },
      {
        type: "pcb_port",
        pcb_port_id: "pp_POLY",
        source_port_id: "sp_POLY",
        x: -20.5,
        y: 0.5,
        layers: ["top"],
      },
      sourceTrace("gap", ["A", "B"]),
      trace("gap_copper", "gap", [wire(0, 0), wire(5, 0)]),
    ] as AnyCircuitElement[]
  const corners = [
    { x: -21, y: 0 },
    { x: -20, y: 0 },
    { x: -20, y: 1 },
    { x: -21, y: 1 },
  ]
  const expected = ["missing_connection_gap_copper_pp_B"]
  expect(missingConnections(polygonPad(corners))).toEqual(expected)
  expect(missingConnections(polygonPad([...corners, corners[0]!]))).toEqual(
    expected,
  )
})
