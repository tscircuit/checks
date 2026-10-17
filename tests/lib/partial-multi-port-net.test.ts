import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

function fixture(named = true): AnyCircuitElement[] {
  return [
    ...["U1", "R1", "J1"].flatMap((name, i) => [
      {
        type: "source_component",
        source_component_id: `source_component_${i}`,
        ...(named ? { name } : {}),
        ftype: "simple_chip",
      },
      {
        type: "source_port",
        source_port_id: `source_port_${i}`,
        source_component_id: `source_component_${i}`,
        name: "pin1",
        pin_number: 1,
        port_hints: ["pin1"],
      },
      {
        type: "pcb_port",
        pcb_port_id: `pcb_port_${i}`,
        source_port_id: `source_port_${i}`,
        pcb_component_id: `pcb_component_${i}`,
        x: i * 5,
        y: 0,
        layers: ["top"],
      },
    ]),
    {
      type: "source_trace",
      source_trace_id: "source_trace_required",
      connected_source_port_ids: [
        "source_port_0",
        "source_port_1",
        "source_port_2",
      ],
      connected_source_net_ids: [],
    },
    branch(0, 1),
  ] as AnyCircuitElement[]
}
function branch(a: number, b: number): AnyCircuitElement {
  return {
    type: "pcb_trace",
    pcb_trace_id: `pcb_trace_${a}_${b}`,
    source_trace_id: "source_trace_required",
    route: [
      {
        route_type: "wire",
        x: a * 5,
        y: 0,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: `pcb_port_${a}`,
      },
      {
        route_type: "wire",
        x: b * 5,
        y: 0,
        width: 0.2,
        layer: "top",
        end_pcb_port_id: `pcb_port_${b}`,
      },
    ],
  }
}
for (const named of [true, false]) {
  test(`partially routed three-port net reports its missing branch (${named ? "named" : "unnamed"})`, () => {
    const errors = checkEachPcbPortConnectedToPcbTraces(fixture(named))
    expect(errors).toHaveLength(1)
    expect(errors[0]!.pcb_port_ids).toContain("pcb_port_2")
    expect(containsCircuitJsonId(errors[0]!.message)).toBe(false)
  })
}
test("two physically joined branches satisfy a three-port source trace", () => {
  expect(
    checkEachPcbPortConnectedToPcbTraces([...fixture(), branch(1, 2)]),
  ).toEqual([])
})
test("a disconnected stub does not complete the remaining branch", () => {
  const c = fixture()
  c.push({
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_stub",
    source_trace_id: "source_trace_required",
    route: [
      {
        route_type: "wire",
        x: 10,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "pcb_port_2",
      },
      { route_type: "wire", x: 11, y: 0, layer: "top", width: 0.2 },
    ],
  })
  expect(checkEachPcbPortConnectedToPcbTraces(c)).toHaveLength(1)
})

test("partial branch PCB reproduction", async () => {
  const { convertCircuitJsonToPcbSvg } = await import("circuit-to-svg")
  const c = fixture()
  c.push({
    type: "pcb_board",
    pcb_board_id: "pcb_board_repro",
    center: { x: 5, y: 0 },
    width: 13,
    height: 4,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  })
  for (const [i, name] of ["U1", "R1", "J1"].entries()) {
    c.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      pcb_port_id: `pcb_port_${i}`,
      shape: "rect",
      x: i * 5,
      y: 0,
      width: 0.7,
      height: 0.7,
      layer: "top",
    })
    c.push({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: `pcb_silkscreen_text_${i}`,
      pcb_component_id: `pcb_component_${i}`,
      text: name,
      layer: "top",
      anchor_position: { x: i * 5, y: -0.9 },
      anchor_alignment: "center",
      font_size: 0.45,
      font: "tscircuit2024",
      ccw_rotation: 0,
    })
  }
  const errors = checkEachPcbPortConnectedToPcbTraces(c)
  expect(errors).toHaveLength(1)
  expect(convertCircuitJsonToPcbSvg([...c, ...errors])).toMatchSvgSnapshot(
    import.meta.path,
  )
})
