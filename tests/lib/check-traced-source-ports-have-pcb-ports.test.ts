import { describe, expect, test } from "bun:test"
import { checkTracedSourcePortsHavePcbPorts } from "lib/check-traced-source-ports-have-pcb-ports"

const makeCircuitJson = ({
  connectedSourceNetIds = [],
  includePcbPort = false,
  includePcbComponent = true,
  includeTrace = true,
}: {
  connectedSourceNetIds?: string[]
  includePcbPort?: boolean
  includePcbComponent?: boolean
  includeTrace?: boolean
} = {}) =>
  [
    {
      type: "source_component",
      source_component_id: "source_component_sw1",
      ftype: "simple_push_button",
      name: "SW1",
    },
    {
      type: "source_port",
      source_port_id: "source_port_sw1_pin1",
      source_component_id: "source_component_sw1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["pin1", "1"],
    },
    ...(includePcbComponent
      ? [
          {
            type: "pcb_component",
            pcb_component_id: "pcb_component_sw1",
            source_component_id: "source_component_sw1",
            center: { x: 0, y: 0 },
            width: 4,
            height: 3,
            rotation: 0,
            layer: "top",
            obstructs_within_bounds: true,
          },
        ]
      : []),
    ...(includePcbPort
      ? [
          {
            type: "pcb_port",
            pcb_port_id: "pcb_port_sw1_pin1",
            pcb_component_id: "pcb_component_sw1",
            source_port_id: "source_port_sw1_pin1",
            x: 0,
            y: 0,
            layers: ["top"],
          },
        ]
      : []),
    ...(includeTrace
      ? [
          {
            type: "source_trace",
            source_trace_id: "source_trace_sw1_pin1",
            connected_source_port_ids: ["source_port_sw1_pin1"],
            connected_source_net_ids: connectedSourceNetIds,
          },
        ]
      : []),
  ] as any

describe("checkTracedSourcePortsHavePcbPorts", () => {
  test("reports a traced switch port that has no matching PCB port", () => {
    const errors = checkTracedSourcePortsHavePcbPorts(makeCircuitJson())

    expect(errors).toEqual([
      {
        type: "pcb_port_not_matched_error",
        pcb_error_id: "pcb_port_not_matched_source_port_sw1_pin1",
        error_type: "pcb_port_not_matched_error",
        message:
          "Source port [SW1.pin1] is used by a trace but has no matching PCB port. Check that its footprint pad has a matching port hint.",
        pcb_component_ids: ["pcb_component_sw1"],
        subcircuit_id: undefined,
      },
    ])
  })

  test("checks source ports connected through named nets", () => {
    const errors = checkTracedSourcePortsHavePcbPorts(
      makeCircuitJson({ connectedSourceNetIds: ["source_net_gnd"] }),
    )

    expect(errors).toHaveLength(1)
  })

  test("does not report matched, untraced, or unplaced source ports", () => {
    expect(
      checkTracedSourcePortsHavePcbPorts(
        makeCircuitJson({ includePcbPort: true }),
      ),
    ).toHaveLength(0)
    expect(
      checkTracedSourcePortsHavePcbPorts(
        makeCircuitJson({ includeTrace: false }),
      ),
    ).toHaveLength(0)
    expect(
      checkTracedSourcePortsHavePcbPorts(
        makeCircuitJson({ includePcbComponent: false }),
      ),
    ).toHaveLength(0)
  })
})
