import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceNet, SourceTrace } from "circuit-json"
import { checkSameNameNetsAreConnected, runAllNetlistChecks } from "../../index"

const net = (id: string, name = "GND", subcircuit = id): SourceNet => ({
  type: "source_net",
  source_net_id: id,
  name,
  member_source_group_ids: [],
  subcircuit_id: subcircuit,
})
const trace = (
  id: string,
  nets: string[],
  ports: string[] = [],
): SourceTrace => ({
  type: "source_trace",
  source_trace_id: id,
  connected_source_net_ids: nets,
  connected_source_port_ids: ports,
})

test("warns for same-name disconnected nets across subcircuits and runs with netlist checks", async () => {
  const input = [net("a"), net("b")]
  const warnings = checkSameNameNetsAreConnected(input)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]!.source_net_ids).toEqual(["a", "b"])
  expect(warnings[0]!.net_name).toBe("GND")
  expect(warnings[0]!.subcircuit_id).toBeUndefined()
  expect(await runAllNetlistChecks(input)).toEqual(warnings)
})

test("warns within a subcircuit, once per name even with partially connected nets", () => {
  const warnings = checkSameNameNetsAreConnected([
    net("a", "GND", "s"),
    net("b", "GND", "s"),
    net("c", "GND", "s"),
    trace("t", ["a", "b"]),
  ])
  expect(warnings).toHaveLength(1)
  expect(warnings[0]!.subcircuit_id).toBe("s")
  expect(warnings[0]!.source_net_ids).toEqual(["a", "b", "c"])
})

test("ignores unique, blank, and differently cased names", () => {
  expect(
    checkSameNameNetsAreConnected([
      net("a"),
      net("b", "gnd"),
      net("c", ""),
      net("d", ""),
    ]),
  ).toEqual([])
})

test("follows direct, transitive, and shared-port connections independent of order", () => {
  const input = [
    net("a"),
    net("b"),
    net("c", "OTHER"),
    trace("1", ["a"], ["p1"]),
    trace("2", ["b"], ["p2"]),
    trace("3", ["c"], ["p1", "p2"]),
  ]
  expect(checkSameNameNetsAreConnected(input)).toEqual([])
  expect(checkSameNameNetsAreConnected(input.toReversed())).toEqual([])
  expect(
    checkSameNameNetsAreConnected([net("a"), net("b"), trace("t", ["a", "b"])]),
  ).toEqual([])
})

test("follows both representations of internal pin connections", () => {
  const input: AnyCircuitElement[] = [
    net("a"),
    net("b"),
    trace("1", ["a"], ["p1"]),
    trace("2", ["b"], ["p2"]),
  ]
  expect(
    checkSameNameNetsAreConnected([
      ...input,
      {
        type: "source_component_internal_connection",
        source_component_internal_connection_id: "ic",
        source_component_id: "c",
        source_port_ids: ["p1", "p2"],
      },
    ]),
  ).toEqual([])
  expect(
    checkSameNameNetsAreConnected([
      ...input,
      {
        type: "source_component",
        source_component_id: "c",
        ftype: "simple_chip",
        name: "U1",
        internally_connected_source_port_ids: [["p1", "p2"]],
      },
    ]),
  ).toEqual([])
})

test("does not treat equal scoped connectivity keys or names as electrical connections", () => {
  expect(
    checkSameNameNetsAreConnected(
      [net("a"), net("b")].map((n) => ({
        ...n,
        subcircuit_connectivity_map_key: "connectivity_net0",
      })),
    ),
  ).toHaveLength(1)
})
