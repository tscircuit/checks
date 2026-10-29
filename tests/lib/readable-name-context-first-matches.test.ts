import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  createReadableNameContext,
  getReadableNameForElementId,
  getReadableNameForPort,
  getReadableNameForSourceTrace,
  getReadableNameForTrace,
} from "lib/util/get-readable-names"

test("readable name indexes preserve first matching typed IDs and source-port mappings", (): void => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "component",
      ftype: "simple_chip",
      name: "U1",
    },
    {
      type: "source_component",
      source_component_id: "component",
      ftype: "simple_chip",
      name: "Later component",
    },
    {
      type: "source_port",
      source_port_id: "a",
      source_component_id: "component",
      name: "A",
    },
    {
      type: "source_port",
      source_port_id: "a",
      source_component_id: "component",
      name: "Later pin",
    },
    {
      type: "source_port",
      source_port_id: "b",
      source_component_id: "component",
      name: "B",
    },
    {
      type: "pcb_port",
      pcb_port_id: "shared",
      source_port_id: "a",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "shared",
      source_port_id: "b",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "second",
      source_port_id: "b",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "source_trace",
      source_trace_id: "shared",
      connected_source_port_ids: ["b", "a"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "shared",
      connected_source_port_ids: [],
      connected_source_net_ids: [],
      display_name: "Later trace",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "shared",
      route: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "missing",
      route: [],
    },
    {
      type: "pcb_via",
      pcb_via_id: "shared",
      x: 0,
      y: 0,
      hole_diameter: 0.2,
      outer_diameter: 0.4,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "unlinked",
      source_port_id: "missing_source_port",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "source_component",
      source_component_id: "",
      ftype: "simple_chip",
      name: "U0",
    },
    {
      type: "source_port",
      source_port_id: "empty_component_port",
      source_component_id: "",
      name: "ZERO",
    },
    {
      type: "pcb_port",
      pcb_port_id: "empty_parent_pin",
      source_port_id: "empty_component_port",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "source_port",
      source_port_id: "ownerless",
      name: "TEST",
    },
    {
      type: "pcb_port",
      pcb_port_id: "ownerless_pin",
      source_port_id: "ownerless",
      x: 0,
      y: 0,
      layers: ["top"],
    },
  ]
  const context = createReadableNameContext(circuit)
  for (const id of [
    "component",
    "a",
    "b",
    "shared",
    "second",
    "trace",
    "missing",
    "unlinked",
    "empty_parent_pin",
    "ownerless_pin",
    "",
  ]) {
    expect(getReadableNameForElementId(circuit, id, context)).toBe(
      getReadableNameForElementId(circuit, id),
    )
    expect(getReadableNameForPort(circuit, id, context)).toBe(
      getReadableNameForPort(circuit, id),
    )
    expect(getReadableNameForTrace(circuit, id, context)).toBe(
      getReadableNameForTrace(circuit, id),
    )
  }
  for (const sourceTrace of circuit.filter(
    (element) => element.type === "source_trace",
  )) {
    expect(getReadableNameForSourceTrace(circuit, sourceTrace, context)).toBe(
      getReadableNameForSourceTrace(circuit, sourceTrace),
    )
  }
  expect(getReadableNameForPort(circuit, "ownerless_pin", context)).toBe("TEST")
  expect(getReadableNameForPort(circuit, "shared", context)).toBe("U1.A")
  expect(getReadableNameForPort(circuit, "unlinked", context)).toBe(
    "unnamed port",
  )
  expect(getReadableNameForPort(circuit, "empty_parent_pin", context)).toBe(
    "U0.ZERO",
  )
})
